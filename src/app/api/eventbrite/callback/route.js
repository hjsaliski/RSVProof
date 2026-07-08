import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// State tokens older than this are rejected, in case a stale, abandoned
// OAuth attempt gets picked back up somehow.
const STATE_MAX_AGE_MINUTES = 10;

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const eventbriteError = searchParams.get('error');

  const redirectTo = (status) => NextResponse.redirect(`${origin}/dashboard/connect?eventbrite=${status}`);

  if (eventbriteError) {
    // The organizer clicked "Deny" on Eventbrite's approval screen, or
    // something else went wrong on their end before we ever got a code.
    return redirectTo('denied');
  }

  if (!code || !state) {
    return redirectTo('error');
  }

  // Look up and immediately delete the state token, one-time use only.
  const { data: stateRow, error: stateError } = await supabaseAdmin
    .from('eventbrite_oauth_states')
    .select('*')
    .eq('state', state)
    .single();

  if (stateError || !stateRow) {
    return redirectTo('error');
  }

  await supabaseAdmin.from('eventbrite_oauth_states').delete().eq('state', state);

  const ageMinutes = (Date.now() - new Date(stateRow.created_at).getTime()) / 60000;
  if (ageMinutes > STATE_MAX_AGE_MINUTES) {
    return redirectTo('expired');
  }

  // Exchange the authorization code for an access token.
  const tokenRes = await fetch('https://www.eventbrite.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.EVENTBRITE_CLIENT_ID,
      client_secret: process.env.EVENTBRITE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.EVENTBRITE_REDIRECT_URI,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error('Eventbrite token exchange failed:', tokenJson);
    return redirectTo('error');
  }

  // Fetch basic profile info so the connect page can show "Connected as
  // ___" instead of a blank confirmation.
  let eventbriteUserId = null;
  let eventbriteEmail = null;
  try {
    const meRes = await fetch('https://www.eventbriteapi.com/v3/users/me/', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const meJson = await meRes.json();
    eventbriteUserId = meJson.id || null;
    eventbriteEmail = meJson.emails?.find((e) => e.primary)?.email || meJson.emails?.[0]?.email || null;
  } catch (err) {
    console.error('Fetching Eventbrite profile failed (non-fatal):', err);
  }

  const { error: upsertError } = await supabaseAdmin
    .from('eventbrite_connections')
    .upsert({
      organizer_id: stateRow.organizer_id,
      access_token: tokenJson.access_token,
      eventbrite_user_id: eventbriteUserId,
      eventbrite_email: eventbriteEmail,
      connected_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error('Saving Eventbrite connection failed:', upsertError);
    return redirectTo('error');
  }

  return redirectTo('connected');
}
