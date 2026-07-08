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

  const ebRes = await fetch(
    'https://www.eventbriteapi.com/v3/users/me/events/?order_by=start_desc',
    { headers: { Authorization: `Bearer ${connection.access_token}` } }
  );

  if (!ebRes.ok) {
    const errJson = await ebRes.json().catch(() => ({}));
    console.error('Eventbrite events fetch failed:', errJson);
    return NextResponse.json(
      { error: errJson.error_description || errJson.error || 'Could not load Eventbrite events' },
      { status: 502 }
    );
  }

  const ebJson = await ebRes.json();
  const events = (ebJson.events || []).map((e) => ({
    id: e.id,
    name: e.name?.text || 'Untitled event',
    startDate: e.start?.local,
    url: e.url,
  }));

  return NextResponse.json({ events });
}