import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { cancelAttendeeDeposit } from '@/lib/cancelDeposit';
import { cancelEventAndAttendees } from '@/lib/cancelEvent';

// Eventbrite's webhook payload is intentionally thin, just enough to tell
// us something happened and where to fetch the real details:
// { config: { action, ... }, api_url: "https://www.eventbriteapi.com/v3/orders/123/" }
// Earlier this handler tried to identify the organizer via config.user_id,
// but that value turned out not to reliably match the personal user ID
// captured during OAuth (likely an organization ID instead, a separate
// Eventbrite concept). Rather than chase that down, the webhook URL now
// carries our own internal event ID directly as a query param, set at
// registration time, so there's nothing to guess or match here at all.
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const rsvproofEventId = searchParams.get('rsvproofEventId');

  const body = await request.json().catch(() => null);
  const action = body?.config?.action;
  const handledActions = ['order.placed', 'order.refunded', 'event.updated'];

  if (!rsvproofEventId || !body?.api_url || !handledActions.includes(action)) {
    // Acknowledge anything we don't recognize so Eventbrite doesn't retry
    // forever, rather than erroring on actions we're not subscribed to.
    return NextResponse.json({ received: true });
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', rsvproofEventId)
    .single();

  if (!event) {
    console.error('Webhook fired for an unknown RSVproof event id:', rsvproofEventId);
    return NextResponse.json({ received: true });
  }

  const { data: connection } = await supabaseAdmin
    .from('eventbrite_connections')
    .select('access_token')
    .eq('organizer_id', event.organizer_id)
    .single();

  if (!connection) {
    console.error('No Eventbrite connection found for organizer:', event.organizer_id);
    return NextResponse.json({ received: true });
  }

  if (action === 'event.updated') {
    // This fires on any edit to the event, not just cancellation, so this
    // only acts when the status specifically comes back as canceled.
    const eventRes = await fetch(body.api_url, {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });

    if (!eventRes.ok) {
      console.error('Fetching Eventbrite event details failed:', await eventRes.text());
      return NextResponse.json({ received: true });
    }

    const ebEvent = await eventRes.json();
    console.error('event.updated received, status field is:', ebEvent.status);
    if (ebEvent.status === 'canceled') {
      try {
        await cancelEventAndAttendees(event.id);
      } catch (err) {
        console.error('Cancelling event from Eventbrite sync failed:', err);
      }
    }

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
  const ebAttendees = order.attendees || [];

  if (action === 'order.placed') {
    for (const ebAttendee of ebAttendees) {
      await handleNewAttendee(ebAttendee, event);
    }
  } else {
    for (const ebAttendee of ebAttendees) {
      await handleCancelledAttendee(ebAttendee);
    }
  }

  return NextResponse.json({ received: true, processed: ebAttendees.length });
}

async function handleNewAttendee(ebAttendee, event) {
  const profile = ebAttendee.profile || {};
  if (!profile.email) return; // nothing to invite without an email

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

async function handleCancelledAttendee(ebAttendee) {
  // No email is sent from here. Eventbrite already confirmed the
  // cancellation to the attendee on their end, this just syncs RSVproof's
  // own record so they don't get charged as a no-show for an event they
  // already backed out of.
  const { data: attendee } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('eventbrite_attendee_id', ebAttendee.id)
    .single();

  if (!attendee) {
    console.error('order.refunded for unknown eventbrite_attendee_id:', ebAttendee.id);
    return;
  }

  try {
    await cancelAttendeeDeposit(attendee);
  } catch (err) {
    console.error('Cancelling attendee from Eventbrite refund failed:', err);
  }
}