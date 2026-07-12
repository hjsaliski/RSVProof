import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Re-checks the organizer's connected account status directly with
// Stripe. Called right after they return from the hosted onboarding flow
// (so the profile page reflects reality immediately, rather than waiting
// on webhook delivery), and safe to call any time as a manual refresh.
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

  const { data: profile } = await supabaseAdmin
    .from('organizer_profiles')
    .select('stripe_account_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.stripe_account_id) {
    return NextResponse.json({ connected: false, chargesEnabled: false });
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id);

  await supabaseAdmin
    .from('organizer_profiles')
    .update({ stripe_charges_enabled: !!account.charges_enabled })
    .eq('id', userData.user.id);

  return NextResponse.json({
    connected: true,
    chargesEnabled: !!account.charges_enabled,
  });
}