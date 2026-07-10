// Shared Eventbrite helpers, used by both the manual "Link" flow and
// automatic event sync. Kept general enough that if another platform
// (Partiful, RSVPify, etc.) gets added later, it can follow the same
// organization -> webhook shape rather than needing a different pattern.

export async function getEventbriteOrganizationId(accessToken) {
  const orgsRes = await fetch('https://www.eventbriteapi.com/v3/users/me/organizations/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!orgsRes.ok) {
    const errJson = await orgsRes.json().catch(() => ({}));
    throw new Error(errJson.error_description || errJson.error || 'Could not load Eventbrite organization');
  }

  const orgsJson = await orgsRes.json();
  const organizationId = orgsJson.organizations?.[0]?.id;
  if (!organizationId) {
    throw new Error('No Eventbrite organization found on this account');
  }
  return organizationId;
}

// Registers the per-event webhook (order.placed, order.refunded) that
// syncs attendee signups and cancellations for one specific event. Used
// both when an organizer manually links an event, and automatically right
// after an event gets auto-created from Eventbrite's event.created webhook.
export async function registerEventbriteEventWebhook({
  accessToken,
  organizationId,
  eventbriteEventId,
  rsvproofEventId,
  origin,
}) {
  const webhookRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/webhooks/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      endpoint_url: `${origin}/api/eventbrite/webhook?rsvproofEventId=${rsvproofEventId}`,
      actions: 'order.placed,order.refunded,event.updated',
      event_id: eventbriteEventId,
    }),
  });

  if (!webhookRes.ok) {
    const errJson = await webhookRes.json().catch(() => ({}));
    throw new Error(errJson.error_description || errJson.error || 'Could not register the Eventbrite event webhook');
  }
}

// Registers the organization-level webhook that fires whenever the
// organizer publishes an event on Eventbrite, so RSVproof can mirror it
// automatically. Subscribed to event.published rather than event.created
// specifically, since event.created also fires for draft events that
// haven't been published yet, and drafts can be freely deleted on
// Eventbrite with no restrictions. Syncing on creation would leave orphaned
// events in RSVproof if an organizer abandoned or deleted a draft, since
// Eventbrite has no event.deleted webhook to clean that up automatically.
// Registered once, right after OAuth connect, not per-event, since no
// event exists yet at connection time to scope a per-event webhook to.
export async function registerEventbriteOrgWebhook({
  accessToken,
  organizationId,
  organizerId,
  origin,
}) {
  const webhookRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/webhooks/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      endpoint_url: `${origin}/api/eventbrite/org-webhook?organizerId=${organizerId}`,
      actions: 'event.published',
    }),
  });

  if (!webhookRes.ok) {
    const errJson = await webhookRes.json().catch(() => ({}));
    throw new Error(errJson.error_description || errJson.error || 'Could not register the Eventbrite org webhook');
  }
}