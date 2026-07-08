-- Run this in the Supabase SQL editor for your project.
-- This sets up the core tables for Phase 1: organizers, events, and attendees.

-- Organizers are just Supabase Auth users, so we don't need a separate table
-- for login, but we do want a profile row for display name / business name.
create table if not exists organizer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  location text,
  event_date timestamptz not null,
  checkin_cutoff timestamptz not null, -- after this time, unscanned attendees are charged
  deposit_amount_cents integer not null default 500, -- $5.00 default
  deposit_enabled boolean not null default true,
  currency text not null default 'usd',
  stripe_terms_note text, -- optional custom terms shown to attendees
  status text not null default 'active', -- active | closed | charges_processed
  created_at timestamptz default now()
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  qr_token text not null unique, -- random token embedded in the QR code
  checked_in_at timestamptz,
  checked_in_method text, -- 'scan' | 'manual'
  charge_status text not null default 'pending', -- pending | not_charged | charged | charge_failed
  stripe_charge_id text,
  created_at timestamptz default now()
);

create index if not exists idx_attendees_event_id on attendees(event_id);
create index if not exists idx_attendees_qr_token on attendees(qr_token);
create index if not exists idx_events_organizer_id on events(organizer_id);

-- Row Level Security: organizers can only see their own events and attendees.
-- The public attendee signup page and the no-show cron job use the service
-- role key server-side, which bypasses RLS, so this only governs the
-- dashboard's direct browser access.
alter table organizer_profiles enable row level security;
alter table events enable row level security;
alter table attendees enable row level security;

create policy "Organizers can view their own profile"
  on organizer_profiles for select
  using (auth.uid() = id);

create policy "Organizers can update their own profile"
  on organizer_profiles for update
  using (auth.uid() = id);

create policy "Organizers can insert their own profile"
  on organizer_profiles for insert
  with check (auth.uid() = id);

create policy "Organizers can manage their own events"
  on events for all
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

create policy "Organizers can view attendees of their own events"
  on attendees for select
  using (
    exists (
      select 1 from events
      where events.id = attendees.event_id
      and events.organizer_id = auth.uid()
    )
  );

create policy "Organizers can update attendees of their own events"
  on attendees for update
  using (
    exists (
      select 1 from events
      where events.id = attendees.event_id
      and events.organizer_id = auth.uid()
    )
  );
