import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cancelAttendeeDeposit } from '@/lib/cancelDeposit';
import { resend } from '@/lib/resend';

// No auth here on purpose. Attendees don't have RSVproof accounts, the
// unguessable cancel_token in the URL is what stands in for authentication,
// same pattern as invite_token and qr_token elsewhere in the app.

// Used by the /cancel/[token] page on load, to decide what to show before
// the attendee commits to anything.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cancelToken = searchParams.get('token');
  if (!cancelToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const { data: attendee } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('cancel_token', cancelToken)
    .single();

  if (!attendee) {
    return NextResponse.json({ error: 'This cancellation link is invalid.' }, { status: 404 });
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('name, deposit_amount_cents')
    .eq('id', attendee.event_id)
    .single();

  if (attendee.charge_status === 'cancelled') {
    return NextResponse.json({ status: 'already_cancelled', eventName: event?.name });
  }
  if (attendee.checked_in_at) {
    return NextResponse.json({ status: 'checked_in', eventName: event?.name });
  }
  if (attendee.charge_status === 'charged') {
    return NextResponse.json({ status: 'already_charged', eventName: event?.name });
  }

  return NextResponse.json({
    status: 'cancellable',
    eventName: event?.name,
    depositDisplay: `$${((event?.deposit_amount_cents || 0) / 100).toFixed(2)}`,
  });
}

// Fires when the attendee actually clicks the confirm button on the page.
export async function POST(request) {
  const { cancelToken } = await request.json().catch(() => ({}));
  if (!cancelToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const { data: attendee } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('cancel_token', cancelToken)
    .single();

  if (!attendee) {
    return NextResponse.json({ error: 'This cancellation link is invalid.' }, { status: 404 });
  }

  if (attendee.checked_in_at) {
    return NextResponse.json({ error: 'You are already checked in for this event.' }, { status: 400 });
  }
  if (attendee.charge_status === 'charged') {
    return NextResponse.json({ error: 'This deposit has already been charged.' }, { status: 400 });
  }

  const { data: event } = await supabaseAdmin
    .from('events')
    .select('name')
    .eq('id', attendee.event_id)
    .single();

  let alreadyCancelled = true;
  try {
    ({ alreadyCancelled } = await cancelAttendeeDeposit(attendee));
  } catch (err) {
    console.error('Self-cancel failed:', err);
    return NextResponse.json({ error: 'Something went wrong cancelling your deposit. Please try again.' }, { status: 500 });
  }

  // Unlike the Eventbrite path, nothing has told this attendee their
  // cancellation went through yet, so this confirmation email is the only
  // one they'll get.
  if (!alreadyCancelled && attendee.email && resend) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: attendee.email,
        subject: `Deposit cancelled: ${event?.name || 'your event'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
            <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f;">Cancelled</p>
            <h1 style="font-size: 22px; margin: 0 0 4px;">${event?.name || 'Your event'}</h1>
            <p style="color: #5b574c;">Your deposit has been cancelled. Your card will not be charged for this event.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Cancellation confirmation email failed to send:', err);
    }
  }

  return NextResponse.json({ success: true, eventName: event?.name });
}