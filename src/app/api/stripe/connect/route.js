import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Kicks off (or resumes) Stripe Connect onboarding for the logged-in
// organizer. Creates a Standard account once, on first call, then reuses
// it on every later call, since an organizer should only ever have one.
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

  const user = userData.user;

  const { data: profile } = await supabaseAdmin
    .from('organizer_profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single();

  let accountId = profile?.stripe_account_id;

  if (!accountId) {
    // Standard accounts are fully Stripe-hosted, the organizer picks
    // their own capabilities and enters their own banking details on
    // Stripe's own onboarding pages, this app never touches or sees
    // that information directly.
    const account = await stripe.accounts.create({
      type: 'standard',
      email: user.email,
    });
    accountId = account.id;

    await supabaseAdmin
      .from('organizer_profiles')
      .upsert({ id: user.id, stripe_account_id: accountId }, { onConflict: 'id' });
  }

  const siteUrl = process.env.EVENTBRITE_REDIRECT_URI
    ? new URL(process.env.EVENTBRITE_REDIRECT_URI).origin
    : '';

  // refresh_url: Stripe sends the organizer's browser here if the
  // onboarding link itself expired or was invalid, before they finished.
  // return_url: Stripe sends them here once onboarding is complete on
  // their end, though "complete" doesn't necessarily mean charges are
  // enabled yet, Stripe may still be verifying something, which is why
  // the profile page re-checks status rather than assuming success here.
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${siteUrl}/dashboard/profile?stripe_onboarding=refresh`,
    return_url: `${siteUrl}/dashboard/profile?stripe_onboarding=complete`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}