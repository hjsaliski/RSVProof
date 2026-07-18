import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEventbriteOrganizationId, registerEventbriteEventWebhook } from '@/lib/eventbrite';

// Fires when the organizer publishes an event in Eventbrite (not on
// creation, drafts don't trigger this, see registerEventbriteOrgWebhook
// for why). Mirrors it into RSVproof automatically, deposits off and no
// amount set until the organizer configures one, since Eventbrite has no
// equivalent concept to pull a default from. Then immediately registers
// that new event's own order.placed/order.refunded/event.updated webhook,
// so attendee syncing is live right away instead of waiting for a manual
// "Link" click.
export async function POST(request) {
  const { searchParams, origin } = new URL(request.url);
  const organizerId = searchParams.get('organizerId');

  const body = await request.json().catch(() => null);
  if (!organizerId || !body?.api_url || body?.config?.action !== 'event.published') {
    // Acknowledge anything we don't recognize so Eventbrite doesn't retry
    // forever, rather than erroring on actions we're not subscribed to.
    return NextResponse.json({ received: true });
  }

  const { data: connection } = await supabaseAdmin
    .from('eventbrite_connections')
    .select('access_token, organization_id')
    .eq('organizer_id', organizerId)
    .single();

  if (!connection) {
    console.error('org-webhook fired for organizer with no Eventbrite connection:', organizerId);
    return NextResponse.json({ received: true });
  }

  const eventRes = await fetch(`${body.api_url}?expand=venue`, {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });

  if (!eventRes.ok) {
    console.error('Fetching Eventbrite event details failed:', await eventRes.text());
    return NextResponse.json({ received: true });
  }

  const ebEvent = await eventRes.json();

  // Dedupe: Eventbrite webhooks can and do redeliver the same event.
  const { data: existing } = await supabaseAdmin
    .from('events')
    .select('id')
    .eq('eventbrite_event_id', ebEvent.id)
    .single();

  if (existing) {
    return NextResponse.json({ received: true, alreadyExists: true });
  }

  // Online events, or ones without a venue set yet, won't have an address
  // to pull, so this falls back rather than leaving location blank.
  const location = ebEvent.venue?.address?.localized_address_display || 'Online / TBD';

  const { data: newEvent, error: insertError } = await supabaseAdmin
    .from('events')
    .insert({
      organizer_id: organizerId,
      name: ebEvent.name?.text || 'Untitled event',
      event_date: ebEvent.start?.utc,
      location,
      checkin_cutoff: ebEvent.end?.utc,
      // Eventbrite tags every start/end time with the IANA zone the
      // event itself was set up in (e.g. "America/Los_Angeles"),
      // independent of whichever timezone the organizer's browser is
      // currently in. Storing it here means emails display the time an
      // attendee would actually recognize as correct for that event.
      event_timezone: ebEvent.start?.timezone || null,
      deposit_amount_cents: null,
      deposit_enabled: false,
      source: 'eventbrite',
      eventbrite_event_id: ebEvent.id,
      status: 'active',
    })
    .select()
    .single();

  if (insertError) {
    console.error('Auto-creating event from Eventbrite failed:', insertError);
    return NextResponse.json({ received: true });
  }

  try {
    let organizationId = connection.organization_id;
    if (!organizationId) {
      organizationId = await getEventbriteOrganizationId(connection.access_token);
      await supabaseAdmin
        .from('eventbrite_connections')
        .update({ organization_id: organizationId })
        .eq('organizer_id', organizerId);
    }

    await registerEventbriteEventWebhook({
      accessToken: connection.access_token,
      organizationId,
      eventbriteEventId: ebEvent.id,
      rsvproofEventId: newEvent.id,
      origin,
    });
  } catch (err) {
    // The event still exists on the dashboard even if this fails, the
    // organizer just wouldn't get automatic attendee syncing yet. The
    // existing manual "Link" button covers this as a fallback.
    console.error('Registering event-level webhook for auto-created event failed:', err);
  }

  return NextResponse.json({ received: true, eventId: newEvent.id });
}