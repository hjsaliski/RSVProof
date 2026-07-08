-- Run this in the Supabase SQL editor. Adds Phase 2 fields on top of the
-- Phase 1 schema. Safe to run once; each statement only adds a column if
-- it doesn't already exist.

-- Organizer branding, shown on their public event pages.
alter table organizer_profiles add column if not exists brand_color text;
alter table organizer_profiles add column if not exists logo_url text;

-- Forward-looking: which platform an event's signups originate from.
-- Every event created directly in this app is 'standalone'. Future
-- integrations (Eventbrite, etc.) will set this to their own platform key
-- instead of needing a separate table per integration.
alter table events add column if not exists source text not null default 'standalone';
