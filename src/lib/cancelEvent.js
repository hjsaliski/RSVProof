import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resend } from '@/lib/resend';
import { cancelAttendeeDeposit } from '@/lib/cancelDeposit';
import { getOrganizerBusinessName } from '@/lib/getOrganizerBusinessName';

// Cancels an entire event: every attendee gets their deposit released and
// marked cancelled, reusing the exact same per-attendee logic as
// self-cancellation, so behavior can't drift between the two. Attendees
// are notified by email regardless of what triggered this, since even if
// Eventbrite already told them the event is off, it wouldn't have
// mentioned anything about their RSVproof deposit specifically. The event
// itself is marked cancelled rather than deleted, same reasoning as
// individual attendee cancellation: preserves history, dashboard stats,
// and protects against webhook redelivery recreating it.
export async function cancelEventAndAttendees(eventId) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status === 'cancelled') {
    return { alreadyCancelled: true, notified: 0, totalAttendees: 0 };
  }

  const { data: attendees } = await supabaseAdmin
    .from('attendees')
    .select('*')
    .eq('event_id', eventId)
    .neq('charge_status', 'cancelled');

  const businessName = await getOrganizerBusinessName(event.organizer_id);

  let notified = 0;

  for (const attendee of attendees || []) {
    try {
      await cancelAttendeeDeposit(attendee);
    } catch (err) {
      console.error('Cancelling attendee during event cancellation failed:', attendee.id, err);
      continue;
    }

    if (attendee.email && resend) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: attendee.email,
          subject: `Event cancelled: ${event.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
              <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #a9740f; margin: 0 0 8px;">Cancelled</p>
              <h1 style="font-size: 22px; margin: 0 0 4px;">${event.name}</h1>
              ${businessName ? `<p style="font-size: 13px; color: #a39d8c; margin: 0 0 12px;">Hosted by ${businessName}</p>` : ''}
              <p style="color: #5b574c;">
                The organizer has cancelled this event. Your deposit has been
                cancelled and your card will not be charged.
              </p>
            </div>
          `,
        });
        notified++;
      } catch (err) {
        console.error('Event-cancellation email failed to send:', attendee.id, err);
      }
    }
  }

  await supabaseAdmin
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId);

  return { alreadyCancelled: false, notified, totalAttendees: (attendees || []).length };
}