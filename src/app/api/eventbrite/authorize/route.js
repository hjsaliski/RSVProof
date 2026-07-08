import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
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

  // A random, one-time value that ties the callback back to this specific
  // organizer, since the redirect to and from Eventbrite is a full browser
  // navigation with no way to carry an auth header through it.
  const state = randomBytes(24).toString('hex');

  const { error: insertError } = await supabaseAdmin
    .from('eventbrite_oauth_states')
    .insert({ state, organizer_id: userData.user.id });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const authorizeUrl =
    `https://www.eventbrite.com/oauth/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(process.env.EVENTBRITE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(process.env.EVENTBRITE_REDIRECT_URI)}` +
    `&state=${state}`;

  return NextResponse.json({ authorizeUrl });
}
