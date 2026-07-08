import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Called before the attendee enters their card. Creates a Stripe Customer
// and a SetupIntent so we can save the card without charging it yet.
export async function POST(request) {
  const body = await request.json();
  const { eventId, name, email, phone } = body;

  if (!eventId || !name) {
    return NextResponse.json({ error: 'Missing eventId or name' }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, deposit_enabled, status')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (!event.deposit_enabled || event.status !== 'active') {
    return NextResponse.json({ error: 'Deposits are not open for this event' }, { status: 400 });
  }

  const customer = await stripe.customers.create({
    name,
    email: email || undefined,
    phone: phone || undefined,
    metadata: { eventId },
  });

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    usage: 'off_session', // we will charge this later without the customer present
    metadata: { eventId },
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    customerId: customer.id,
  });
}
