import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Separate webhook endpoint from the main Stripe webhook, Connect events
// (things happening on organizers' connected accounts) are registered
// under Stripe's Connect webhook settings with their own signing secret,
// distinct from the platform account's own webhook.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe Connect webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'account.updated') {
    const account = event.data.object;

    const { error } = await supabaseAdmin
      .from('organizer_profiles')
      .update({ stripe_charges_enabled: !!account.charges_enabled })
      .eq('stripe_account_id', account.id);

    if (error) {
      console.error('Failed to sync account.updated status:', account.id, error);
    }
  }

  return NextResponse.json({ received: true });
}