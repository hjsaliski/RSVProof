import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Prevent Next.js from caching this GET route. Without this, it can keep
// serving a stale snapshot of the event even after the organizer changes
// deposit settings, since GET route handlers are cached by default.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public endpoint. Only returns the fields an attendee needs to see,
// never the organizer_id or internal status fields.
export async function GET(request, { params }) {
  const { id } = await params;

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .select('id, organizer_id, name, description, location, event_date, deposit_amount_cents, deposit_enabled, currency, stripe_terms_note, status')
    .eq('id', id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Two separate queries rather than a join: events.organizer_id and
  // organizer_profiles.id both reference auth.users independently, so
  // there's no foreign key between the two tables for PostgREST to follow.
  const { data: profile } = await supabaseAdmin
    .from('organizer_profiles')
    .select('business_name, brand_color, logo_url')
    .eq('id', event.organizer_id)
    .single();

  // Strip organizer_id before returning, it's never meant to reach the browser.
  const publicEvent = { ...event };
  delete publicEvent.organizer_id;

  return NextResponse.json({
    ...publicEvent,
    organizer_business_name: profile?.business_name || null,
    brand_color: profile?.brand_color || null,
    logo_url: profile?.logo_url || null,
  });
}
