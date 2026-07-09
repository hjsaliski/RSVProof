import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

  const { eventId, eventbriteEventId } = await request.json();
  if (!eventId || !eventbriteEventId) {
    return NextResponse.json({ error: 'Missing eventId or eventbriteEventId' }, { status: 400 });
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

  const { data: connection } = await supabaseAdmin
    .from('eventbrite_connections')
    .select('access_token')
    .eq('organizer_id', userData.user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'Eventbrite is not connected' }, { status: 400 });
  }

  const orgsRes = await fetch('https://www.eventbriteapi.com/v3/users/me/organizations/', {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });

  if (!orgsRes.ok) {
    const errJson = await orgsRes.json().catch(() => ({}));
    console.error('Eventbrite organizations fetch failed:', errJson);
    return NextResponse.json(
      { error: errJson.error_description || errJson.error || 'Could not load your Eventbrite organization' },
      { status: 502 }
    );
  }

  const orgsJson = await orgsRes.json();
  const organizationId = orgsJson.organizations?.[0]?.id;

  if (!organizationId) {
    return NextResponse.json({ error: 'No Eventbrite organization found on this account' }, { status: 400 });
  }

  // The webhook URL carries our own internal event id as a query param.
  // Earlier this handler tried to identify the right organizer/event by
  // matching Eventbrite's own user_id from the webhook payload, but that
  // value turned out not to reliably match anything we had stored.
  // Embedding our own id here removes that guesswork entirely.
  const webhookRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/webhooks/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      endpoint_url: `${new URL(request.url).origin}/api/eventbrite/webhook?rsvproofEventId=${event.id}`,
      actions: 'order.placed',
      event_id: eventbriteEventId,
    }),
  });

  if (!webhookRes.ok) {
    const errJson = await webhookRes.json().catch(() => ({}));
    console.error('Eventbrite webhook registration failed:', errJson);
    return NextResponse.json(
      { error: errJson.error_description || errJson.error || 'Could not register the Eventbrite webhook' },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('events')
    .update({ eventbrite_event_id: eventbriteEventId, source: 'eventbrite' })
    .eq('id', eventId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}