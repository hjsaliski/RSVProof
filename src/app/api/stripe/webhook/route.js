import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Needs the Node runtime, not edge, since Stripe's signature verification
// relies on Node's crypto module.
export const runtime = 'nodejs';

// Stripe signs every webhook payload with a secret only Stripe and this
// server know. Without checking that signature, anyone who finds this URL
// could POST a fake "charge succeeded" or similar payload and have it
// treated as real. This is the one thing that makes this endpoint safe to
// expose publicly.
export async function POST(request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Signature verification needs the exact raw bytes Stripe sent, so this
  // reads the body as text rather than calling request.json(), which would
  // re-serialize it and break the signature check.
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.payment_failed': {
      // Off-session charges are confirmed synchronously in charge-no-shows,
      // so a failure there is already caught and recorded on the spot. This
      // case exists for the rarer situation where Stripe retries or settles
      // the charge asynchronously after that initial call already returned
      // success, and it later fails.
      const paymentIntent = event.data.object;
      const attendeeId = paymentIntent.metadata?.attendeeId;

      if (attendeeId) {
        await supabaseAdmin
          .from('attendees')
          .update({ charge_status: 'charge_failed' })
          .eq('id', attendeeId)
          .eq('stripe_charge_id', paymentIntent.id);
      } else {
        console.error('payment_intent.payment_failed with no attendeeId in metadata:', paymentIntent.id);
      }
      break;
    }

    case 'charge.dispute.created': {
      // Logged only for now, not changing charge_status, since deciding how
      // a dispute should affect an attendee's record (and any response to
      // Stripe) is Phase 3 scope. This at least means a dispute shows up
      // somewhere instead of only being visible in the Stripe dashboard.
      const dispute = event.data.object;
      console.error('Stripe dispute opened:', {
        chargeId: dispute.charge,
        amount: dispute.amount,
        reason: dispute.reason,
      });
      break;
    }

    default:
      // Any other event type is acknowledged but intentionally not acted on.
      break;
  }

  return NextResponse.json({ received: true });
}