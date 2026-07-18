import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';

// Manual re-send for an already-invited attendee, used to test the
// Eventbrite -> deposit email path without needing a fresh Eventbrite RSVP
// each time. Unlike the webhook's silent catch, this returns the actual
// Resend error in the response so it's visible without checking logs.
export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { attendeeId } = await request.json().catch(() => ({}));
  if (!attendeeId) {
    return NextResponse.json({ error: 'attendeeId required' }, { status: 400 });
  }

  const { data: attendee, error: attendeeError } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('id', attendeeId)
    .single();

  if (attendeeError || !attendee) {
    return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', attendee.event_id)
    .single();

  if (eventError || !event || event.organizer_id !== userData.user.id) {
    return NextResponse.json({ error: 'Not your event' }, { status: 403 });
  }

  if (!attendee.invite_token) {
    return NextResponse.json(
      { error: 'This attendee has no invite token, they were not created via the Eventbrite webhook' },
      { status: 400 }
    );
  }

  if (!resend) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not set on the server' }, { status: 500 });
  }

  const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
  const siteUrl = process.env.SITE_URL || '';
  const inviteLink = `${siteUrl}/e/${event.id}?invite=${attendee.invite_token}`;

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: attendee.email,
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

    // Resend's SDK often returns a structured error object here instead
    // of throwing, so this needs its own check separate from the catch.
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || 'Resend rejected the email', details: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 });
  }
}