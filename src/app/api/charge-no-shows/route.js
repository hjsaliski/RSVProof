import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Two ways to trigger this route:
// 1. Organizer clicks "Run no-show charges" on their event dashboard, sending
//    their Supabase auth token plus the specific eventId.
// 2. A scheduled job (cron) calls this with no eventId and a shared secret
//    header, which processes every event whose cutoff has passed.
// Phase 1 has the organizer receiving the money manually (Venmo, etc.),
// since there's no Stripe Connect yet, so this route charges the platform's
// own Stripe account, not a connected organizer account.

async function chargeAttendee(attendee, event) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: event.deposit_amount_cents,
      currency: event.currency || 'usd',
      customer: attendee.stripe_customer_id,
      payment_method: attendee.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `No-show deposit for ${event.name}`,
      metadata: { eventId: event.id, attendeeId: attendee.id },
    });

    await supabaseAdmin
      .from('attendees')
      .update({
        charge_status: 'charged',
        stripe_charge_id: paymentIntent.id,
      })
      .eq('id', attendee.id);

    return { attendeeId: attendee.id, status: 'charged' };
  } catch (err) {
    await supabaseAdmin
      .from('attendees')
      .update({ charge_status: 'charge_failed' })
      .eq('id', attendee.id);

    return { attendeeId: attendee.id, status: 'charge_failed', error: err.message };
  }
}

async function processEvent(event) {
  const { data: noShows } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('event_id', event.id)
    .is('checked_in_at', null)
    .eq('charge_status', 'pending');

  const results = [];
  for (const attendee of noShows || []) {
    results.push(await chargeAttendee(attendee, event));
  }

  // Anyone who checked in gets marked as not charged, so the dashboard
  // shows a clear final status instead of leaving them at "pending".
  await supabaseAdmin
    .from('attendees')
    .update({ charge_status: 'not_charged' })
    .eq('event_id', event.id)
    .not('checked_in_at', 'is', null)
    .eq('charge_status', 'pending');

  await supabaseAdmin
    .from('events')
    .update({ status: 'charges_processed' })
    .eq('id', event.id);

  return results;
}

async function runCronSweep() {
  const { data: dueEvents, error: dueError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('status', 'active')
    .lte('checkin_cutoff', new Date().toISOString());

  if (dueError) {
    return { error: dueError.message };
  }

  const allResults = [];
  for (const event of dueEvents || []) {
    allResults.push({ eventId: event.id, results: await processEvent(event) });
  }

  return { processed: (dueEvents || []).length, allResults };
}

// Vercel's built-in cron scheduler always makes a GET request, and when
// CRON_SECRET is set as an env var, Vercel automatically attaches it as
// "Authorization: Bearer <CRON_SECRET>" on that request. This handler
// exists specifically to match that, separate from the POST path below,
// which stays for the organizer's manual button and any external scheduler.
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runCronSweep();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { eventId } = body;
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    // Manual trigger: verify the requester is logged in and owns this event.
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!eventId) {
      return NextResponse.json({ error: 'eventId required for manual trigger' }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('organizer_id', userData.user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const results = await processEvent(event);
    return NextResponse.json({ processed: 1, results });
  }

  // Cron path (external scheduler using the custom header instead of
  // Vercel's native cron): process every active event past its cutoff.
  const result = await runCronSweep();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
