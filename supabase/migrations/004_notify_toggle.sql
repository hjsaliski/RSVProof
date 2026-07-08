-- Run this in the Supabase SQL editor. Adds an opt-in toggle so organizer
-- notification emails are off by default, since a popular event could mean
-- hundreds of emails otherwise.

alter table organizer_profiles add column if not exists notify_on_signup boolean not null default false;
