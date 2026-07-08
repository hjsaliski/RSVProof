import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';

// Eventbrite's webhook payload is intentionally thin, just enough to tell
// us something happened and where to fetch the real details:
// { config: { action, user_id, ... }, api_url: "https://www.eventbriteapi.com/v3/orders/123/" }
// We use config.user_id to figure out which organizer's access token to
// fetch the actual order with, since the payload itself carries no token.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body?.api_url || body?.config?.action !== 'order.placed') {
    // Acknowledge anything we don't care about so Eventbrite doesn't retry
    // forever, rather than erroring on actions we're not subscribed to.
    return NextResponse.json({ received: true });
  }

  const eventbriteUserId = body.config.user_id;
  const { data: connection } = await supabaseAdmin
    .from('eventbrite_connections')
    .select('organizer_id, access_token')
    .eq('eventbrite_user_id', eventbriteUserId)
    .single();

  if (!connection) {
    console.error('Webhook received for an unrecognized Eventbrite user_id:', eventbriteUserId);
    return NextResponse.json({ received: true });
  }

  const orderRes = await fetch(`${body.api_url}?expand=attendees`, {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });

  if (!orderRes.ok) {
    console.error('Fetching Eventbrite order details failed:', await orderRes.text());
    return NextResponse.json({ received: true });
  }

  const order = await orderRes.json();
  const attendees = order.attendees || [];

  for (const ebAttendee of attendees) {
    await handleAttendee(ebAttendee, connection.organizer_id);
  }

  return NextResponse.json({ received: true, processed: attendees.length });
}

async function handleAttendee(ebAttendee, organizerId) {
  const ebEventId = ebAttendee.event_id;
  const profile = ebAttendee.profile || {};

  if (!profile.email) return; // nothing to invite without an email

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('eventbrite_event_id', ebEventId)
    .eq('organizer_id', organizerId)
    .single();

  if (!event) {
    console.error('No RSVproof event linked to Eventbrite event:', ebEventId);
    return;
  }

  // Dedupe: Eventbrite webhooks can and do redeliver the same event.
  const { data: existing } = await supabaseAdmin
    .from('attendees')
    .select('id')
    .eq('eventbrite_attendee_id', ebAttendee.id)
    .single();

  if (existing) return;

  const inviteToken = randomBytes(16).toString('hex');
  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.name || 'Guest';

  const { error: insertError } = await supabaseAdmin.from('attendees').insert({
    event_id: event.id,
    name,
    email: profile.email,
    eventbrite_attendee_id: ebAttendee.id,
    invite_token: inviteToken,
    charge_status: 'invited',
  });

  if (insertError) {
    console.error('Creating invited attendee failed:', insertError);
    return;
  }

  if (!resend) return;

  const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
  const siteUrl = process.env.EVENTBRITE_REDIRECT_URI
    ? new URL(process.env.EVENTBRITE_REDIRECT_URI).origin
    : '';
  const inviteLink = `${siteUrl}/e/${event.id}?invite=${inviteToken}`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: profile.email,
      subject: `One step left to secure your spot: ${event.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f;">Almost there</p>
          <h1 style="font-size: 22px; margin: 0 0 4px;">${event.name}</h1>
          <p style="color: #5b574c; margin: 0 0 16px;">You RSVP'd on Eventbrite. One more step secures your spot.</p>
          <div style="background: #fbeecb; border-radius: 10px; padding: 14px; font-size: 14px; margin-bottom: 20px;">
            A ${depositDisplay} hold reserves your spot. Nothing is charged if
            you check in at the event.
          </div>
          <a href="${inviteLink}" style="display: inline-block; background: #1c1b17; color: #faf7f0; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
            Secure my spot
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error('Invite email failed to send:', err);
  }
}
