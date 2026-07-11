import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getOrganizerBusinessName } from '@/lib/getOrganizerBusinessName';

// Prevent caching, same reasoning as the public event route: without
// this, a stale snapshot (e.g. showing "not checked in" after someone
// was actually just scanned at the door) could keep being served.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public endpoint, looked up by qr_token, the same token already embedded
// in the attendee's QR code and confirmation email. Anyone holding this
// token is treated as the attendee, identical trust model to the email
// itself, no login exists on the attendee side of this app at all.
export async function GET(request, { params }) {
  const { token } = await params;

  const { data: attendee, error: attendeeError } = await supabaseAdmin
    .from('attendees')
    .select('name, email, qr_token, cancel_token, charge_status, checked_in_at, checked_in_method, event_id')
    .eq('qr_token', token)
    .single();

  if (attendeeError || !attendee) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, name, description, location, event_date, checkin_cutoff, deposit_amount_cents, organizer_id, status')
    .eq('id', attendee.event_id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const businessName = await getOrganizerBusinessName(event.organizer_id);

  return NextResponse.json({
    attendee: {
      name: attendee.name,
      qrToken: attendee.qr_token,
      cancelToken: attendee.cancel_token,
      chargeStatus: attendee.charge_status,
      checkedInAt: attendee.checked_in_at,
      checkedInMethod: attendee.checked_in_method,
    },
    event: {
      id: event.id,
      name: event.name,
      description: event.description,
      location: event.location,
      eventDate: event.event_date,
      checkinCutoff: event.checkin_cutoff,
      depositAmountCents: event.deposit_amount_cents,
      status: event.status,
      organizerBusinessName: businessName,
    },
  });
}