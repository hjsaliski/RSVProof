import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Returns the Stripe account context to use for a given organizer.
// { connected: true, stripeAccountId } means their card/charge operations
// should route through their own connected account, via the standard
// `{ stripeAccount: id }` request option Stripe's SDK uses for direct
// charges. { connected: false, stripeAccountId: null } means they haven't
// finished connecting yet (or never started), and everything should keep
// working exactly like Phase 1: charged to the platform's own account,
// paid out manually.
export async function getOrganizerStripeContext(organizerId) {
  if (!organizerId) return { connected: false, stripeAccountId: null };

  const { data } = await supabaseAdmin
    .from('organizer_profiles')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', organizerId)
    .single();

  const connected = !!(data?.stripe_account_id && data?.stripe_charges_enabled);

  return {
    connected,
    stripeAccountId: connected ? data.stripe_account_id : null,
  };
}