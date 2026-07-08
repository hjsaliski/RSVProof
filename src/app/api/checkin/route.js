import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const body = await request.json();
  const { eventId, qrToken } = body;

  if (!eventId || !qrToken) {
    return NextResponse.json({ error: 'Missing eventId or qrToken' }, { status: 400 });
  }

  const { data: attendee, error: findError } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('event_id', eventId)
    .eq('qr_token', qrToken)
    .single();

  if (findError || !attendee) {
    return NextResponse.json({ error: 'Code not recognized for this event' }, { status: 404 });
  }

  if (attendee.checked_in_at) {
    return NextResponse.json(
      { warning: 'Already checked in', name: attendee.name, checkedInAt: attendee.checked_in_at },
      { status: 200 }
    );
  }

  await supabaseAdmin
    .from('attendees')
    .update({ checked_in_at: new Date().toISOString(), checked_in_method: 'scan' })
    .eq('id', attendee.id);

  return NextResponse.json({ success: true, name: attendee.name });
}
