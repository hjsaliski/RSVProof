-- Run this in the Supabase SQL editor. Adds reminder tracking so the same
-- attendee never gets reminded twice for the same event.

alter table attendees add column if not exists reminder_sent_at timestamptz;
