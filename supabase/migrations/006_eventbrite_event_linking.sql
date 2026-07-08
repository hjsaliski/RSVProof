-- Run this in the Supabase SQL editor.

-- Which Eventbrite event (if any) this RSVproof event is synced to.
-- Null means it's a standalone event, same meaning as events.source.
alter table events add column if not exists eventbrite_event_id text unique;

-- 'invited' is a new charge_status value: someone RSVP'd on a connected
-- platform but hasn't secured a deposit yet, distinct from 'pending'
-- (which means a card is already on file). No schema constraint enforces
-- the allowed values today, so this is just a documented convention.

-- Ties an attendee row back to the specific Eventbrite attendee that
-- created it, so a repeated webhook delivery (which does happen) updates
-- the existing row instead of creating a duplicate.
alter table attendees add column if not exists eventbrite_attendee_id text unique;

-- A one-time link token emailed to invited attendees, letting them land
-- on the deposit page and complete their existing row instead of
-- accidentally creating a second one. Separate from qr_token, which is
-- only generated once a deposit is actually secured.
alter table attendees add column if not exists invite_token text unique;

create index if not exists idx_events_eventbrite_event_id on events(eventbrite_event_id);

-- An invited attendee (RSVP'd via a connected platform, deposit not yet
-- secured) has no card and no QR code yet, both only get set once they
-- actually complete the deposit step. The original schema required these,
-- which only made sense back when every row was created at signup time.
alter table attendees alter column stripe_customer_id drop not null;
alter table attendees alter column stripe_payment_method_id drop not null;
alter table attendees alter column qr_token drop not null;

