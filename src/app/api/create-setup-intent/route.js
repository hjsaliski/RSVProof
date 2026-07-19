import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getOrganizerStripeContext } from '@/lib/getOrganizerStripeContext';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// Called before the attendee enters their card. Creates a Stripe Customer
// and a SetupIntent so we can save the card without charging it yet.
//
// If the organizer has a connected Stripe account, the customer and
// SetupIntent are created directly on that account (the `{ stripeAccount }`
// request option), not the platform's own account. This matters because
// a customer/payment method only exists within whichever account
// namespace it was created under, direct-charging it later requires
// using that exact same account context every time, not just at signup.
export async function POST(request) {
  const body = await request.json();
  const { eventId, name, email, phone, website } = body;

  // Honeypot: a hidden field real attendees never see or fill in, but
  // basic bots that auto-fill every input on a form typically do. Silently
  // reject rather than a visible 400, no reason to tell a bot it found
  // the trap.
  if (website) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 400 });
  }

  if (!eventId || !name) {
    return NextResponse.json({ error: 'Missing eventId or name' }, { status: 400 });
  }

  // Caps how many Stripe Customers one IP can create in a short window.
  // Doesn't block legitimate repeat visits (5 in 10 minutes is generous
  // for one person retrying a signup), but stops a script from hammering
  // this endpoint and running up Stripe object counts or API usage.
  const ip = getClientIp(request);
  const { limited } = await checkRateLimit(`create-setup-intent:${ip}`, 5, 10);
  if (limited) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, deposit_enabled, status, organizer_id')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (!event.deposit_enabled || event.status !== 'active') {
    return NextResponse.json({ error: 'Deposits are not open for this event' }, { status: 400 });
  }

  const { connected, stripeAccountId } = await getOrganizerStripeContext(event.organizer_id);
  const requestOptions = connected ? { stripeAccount: stripeAccountId } : undefined;

  const customer = await stripe.customers.create(
    {
      name,
      email: email || undefined,
      phone: phone || undefined,
      metadata: { eventId },
    },
    requestOptions
  );

  const setupIntent = await stripe.setupIntents.create(
    {
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session', // we will charge this later without the customer present
      metadata: { eventId },
    },
    requestOptions
  );

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    customerId: customer.id,
    stripeAccountId: connected ? stripeAccountId : null,
  });
}