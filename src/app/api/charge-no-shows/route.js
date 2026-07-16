import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { checkEventbriteEventCancelled } from '@/lib/eventbrite';
import { cancelEventAndAttendees } from '@/lib/cancelEvent';

// Two ways to trigger this route:
// 1. Organizer clicks "Run no-show charges" on their event dashboard, sending
//    their Supabase auth token plus the specific eventId.
// 2. A scheduled job (cron) calls this with no eventId and a shared secret
//    header, which processes every event whose cutoff has passed.
//
// Phase 5: whether an attendee gets charged on the platform's own account
// or directly on the organizer's connected account depends entirely on
// attendee.stripe_account_id, snapshotted back at signup time in
// complete-signup. That's a per-attendee decision, not a per-organizer
// one made fresh here, an organizer connecting Stripe mid-event doesn't
// retroactively change how already-saved cards get charged.

// Platform fee, as a percent of the deposit, only ever applied when the
// charge is going through a connected account (there's nothing to take a
// cut of on the platform's own account, that money is already yours).
// Read from an env var so the rate can change without a code deploy.
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '3');

// Where to send the "you collected money on someone's behalf" notice.
// info@rsvproof.com already forwards to a personal inbox via Cloudflare
// Email Routing, so this doesn't need its own env var or destination setup.
const PAYOUT_NOTIFICATION_EMAIL = 'info@rsvproof.com';

// When a charge lands directly on the platform account (no connected
// account on file for this attendee), that money now needs to be
// manually paid out to the organizer, and nothing else in the system
// surfaces that fact on its own, the unpaid_payouts view only shows up
// if someone thinks to query it. This closes that gap: fire an email the
// moment the money actually lands, so a payout obligation is never
// silent.
async function notifyManualPayoutOwed(attendee, event) {
  if (!resend) return;

  try {
    const { data: organizer } = await supabaseAdmin
      .from('organizer_profiles')
      .select('business_name, manual_payout_method, manual_payout_handle')
      .eq('id', event.organizer_id)
      .single();

    const depositDisplay = `$${(event.deposit_amount_cents / 100).toFixed(2)}`;
    const payoutMethod = organizer?.manual_payout_method || 'not set';
    const payoutHandle = organizer?.manual_payout_handle || 'not set';
    const organizerLabel = organizer?.business_name || event.organizer_id;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: PAYOUT_NOTIFICATION_EMAIL,
      subject: `Payout owed: ${depositDisplay} for ${event.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1c1b17;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #a9740f; margin: 0 0 8px;">
            Manual payout needed
          </p>
          <h1 style="font-size: 20px; margin: 0 0 16px;">${depositDisplay} collected for "${event.name}"</h1>
          <p style="margin: 0 0 4px;"><strong>Organizer:</strong> ${organizerLabel}</p>
          <p style="margin: 0 0 4px;"><strong>Payout method:</strong> ${payoutMethod}</p>
          <p style="margin: 0 0 16px;"><strong>Handle:</strong> ${payoutHandle}</p>
          <p style="margin: 0 0 16px; color: #5b574c; font-size: 14px;">
            This organizer isn't connected to Stripe, so this no-show charge landed
            on the platform account instead of paying out automatically. Mark it
            paid once sent:
          </p>
          <pre style="background: #f3eee3; padding: 12px; border-radius: 8px; font-size: 13px; overflow-x: auto;">update events set payout_status = 'paid', payout_marked_paid_at = now() where id = '${event.id}';</pre>
        </div>
      `,
    });
  } catch (err) {
    // Never let a failed notification email block or fail the actual
    // charge, the charge already succeeded and is the important part,
    // this is a best-effort convenience on top of it.
    console.error('Failed to send manual payout notification:', err.message, {
      eventId: event.id,
      attendeeId: attendee.id,
    });
  }
}

async function chargeAttendee(attendee, event) {
  const requestOptions = attendee.stripe_account_id
    ? { stripeAccount: attendee.stripe_account_id }
    : undefined;

  const applicationFeeAmount = attendee.stripe_account_id
    ? Math.round(event.deposit_amount_cents * (PLATFORM_FEE_PERCENT / 100))
    : undefined;

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: event.deposit_amount_cents,
        currency: event.currency || 'usd',
        customer: attendee.stripe_customer_id,
        payment_method: attendee.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `No-show deposit for ${event.name}`,
        metadata: { eventId: event.id, attendeeId: attendee.id },
        ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
      },
      requestOptions
    );

    await supabaseAdmin
      .from('attendees')
      .update({
        charge_status: 'charged',
        stripe_charge_id: paymentIntent.id,
        stripe_application_fee_cents: applicationFeeAmount ?? null,
      })
      .eq('id', attendee.id);

    // Only the direct-to-platform path needs a manual payout notice,
    // connected-account charges already paid the organizer automatically
    // as part of the charge itself.
    if (!attendee.stripe_account_id) {
      await notifyManualPayoutOwed(attendee, event);
    }

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
  // Safety net for Eventbrite-linked events: the event.updated webhook that
  // would normally sync a cancellation has been observed not firing
  // reliably, so this checks directly against Eventbrite's API right
  // before charging anyone, the moment it actually matters. If it turns
  // out the event was cancelled there but never synced, this catches it
  // here instead of charging attendees for an event that isn't happening,
  // and runs the same cancellation cleanup the webhook would have.
  if (event.eventbrite_event_id) {
    try {
      const { data: connection } = await supabaseAdmin
        .from('eventbrite_connections')
        .select('access_token')
        .eq('organizer_id', event.organizer_id)
        .single();

      if (connection) {
        const isCancelled = await checkEventbriteEventCancelled(
          event.eventbrite_event_id,
          connection.access_token
        );

        if (isCancelled) {
          const result = await cancelEventAndAttendees(event.id);
          return [{
            skipped: true,
            reason: 'Event was found cancelled on Eventbrite, no charges were run',
            ...result,
          }];
        }
      }
    } catch (err) {
      // Don't let a failed safety check block the whole charge run, an
      // unreachable Eventbrite API isn't evidence the event was cancelled.
      console.error('Eventbrite live-status check failed, proceeding with charge run:', err);
    }
  }

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