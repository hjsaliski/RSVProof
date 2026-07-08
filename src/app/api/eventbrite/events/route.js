import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: connection } = await supabaseAdmin
    .from('eventbrite_connections')
    .select('access_token')
    .eq('organizer_id', userData.user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'Eventbrite is not connected' }, { status: 400 });
  }

  // /v3/users/me/events/ was deprecated by Eventbrite in 2020 in favor of
  // an organization-scoped flow. It still responds, but with a confusing
  // error rather than a clean "not found", which is why this needs two
  // calls: first find the organization, then list its events.
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
  const organizations = orgsJson.organizations || [];

  if (organizations.length === 0) {
    return NextResponse.json({ error: 'No Eventbrite organization found on this account' }, { status: 400 });
  }

  // Most accounts have exactly one organization. If someone has several,
  // this pulls events from all of them rather than guessing which one.
  const allEvents = [];
  for (const org of organizations) {
    const ebRes = await fetch(
      `https://www.eventbriteapi.com/v3/organizations/${org.id}/events/?order_by=start_desc`,
      { headers: { Authorization: `Bearer ${connection.access_token}` } }
    );

    if (!ebRes.ok) {
      const errJson = await ebRes.json().catch(() => ({}));
      console.error('Eventbrite events fetch failed for org', org.id, errJson);
      continue;
    }

    const ebJson = await ebRes.json();
    allEvents.push(...(ebJson.events || []));
  }

  const events = allEvents.map((e) => ({
    id: e.id,
    name: e.name?.text || 'Untitled event',
    startDate: e.start?.local,
    url: e.url,
  }));

  return NextResponse.json({ events });
}