import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEventbriteOrganizationId, registerEventbriteEventWebhook } from '@/lib/eventbrite';

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
    .select('access_token, organization_id')
    .eq('organizer_id', userData.user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'Eventbrite is not connected' }, { status: 400 });
  }

  try {
    let organizationId = connection.organization_id;
    if (!organizationId) {
      organizationId = await getEventbriteOrganizationId(connection.access_token);
      await supabaseAdmin
        .from('eventbrite_connections')
        .update({ organization_id: organizationId })
        .eq('organizer_id', userData.user.id);
    }

    // The webhook URL carries our own internal event id as a query param.
    // Earlier this handler tried to identify the right organizer/event by
    // matching Eventbrite's own user_id from the webhook payload, but that
    // value turned out not to reliably match anything we had stored.
    // Embedding our own id here removes that guesswork entirely.
    await registerEventbriteEventWebhook({
      accessToken: connection.access_token,
      organizationId,
      eventbriteEventId,
      rsvproofEventId: event.id,
      origin: new URL(request.url).origin,
    });
  } catch (err) {
    console.error('Eventbrite webhook registration failed:', err);
    return NextResponse.json({ error: err.message || 'Could not register the Eventbrite webhook' }, { status: 502 });
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