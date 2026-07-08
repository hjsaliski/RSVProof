-- Run this in the Supabase SQL editor.

-- Stores each organizer's connected Eventbrite account. One row per
-- organizer; connecting again simply replaces the existing row.
create table if not exists eventbrite_connections (
  organizer_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  eventbrite_user_id text,
  eventbrite_email text,
  connected_at timestamptz not null default now()
);

alter table eventbrite_connections enable row level security;

create policy "Organizers can view their own Eventbrite connection"
  on eventbrite_connections for select
  using (auth.uid() = organizer_id);

-- Short-lived, one-time tokens used only to carry an organizer's identity
-- through the OAuth round trip to Eventbrite and back, since that redirect
-- happens as a full browser navigation with no way to attach an auth
-- header. Each row is deleted immediately after use in the callback route.
create table if not exists eventbrite_oauth_states (
  state text primary key,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
