import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Shared by both cancellation entry points, Eventbrite's order.refunded
// webhook and the RSVproof self-cancel page, so the actual cancellation
// behavior can't drift out of sync between the two. Always marks the row
// cancelled rather than deleting it, so webhook redelivery can't recreate
// it as a "new" signup, and the dashboard/reporting keeps an accurate
// record of what happened.
export async function cancelAttendeeDeposit(attendee) {
  if (attendee.charge_status === 'cancelled') {
    return { alreadyCancelled: true };
  }

  // This architecture saves a card via SetupIntent rather than placing an
  // upfront authorization hold, so there's no hold to "release" in the
  // Stripe sense. Detaching the saved payment method is the equivalent
  // here: it guarantees no future off-session charge can succeed against
  // it, even as a second layer of safety beyond just updating the status.
  if (attendee.stripe_payment_method_id) {
    try {
      await stripe.paymentMethods.detach(attendee.stripe_payment_method_id);
    } catch (err) {
      // Already detached, or the method/customer no longer exists. Either
      // way the outcome we care about, no future charge, already holds,
      // so this isn't treated as a failure.
      console.error('Stripe payment method detach failed during cancellation:', err.message);
    }
  }

  const { error } = await supabaseAdmin
    .from('attendees')
    .update({ charge_status: 'cancelled' })
    .eq('id', attendee.id);

  if (error) {
    throw new Error(`Failed to mark attendee cancelled: ${error.message}`);
  }

  return { alreadyCancelled: false };
}