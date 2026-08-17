-- check-my-jalendar schema
-- Paste this into the Supabase SQL editor (Project -> SQL Editor -> New query -> Run).
-- Safe to re-run: uses IF NOT EXISTS everywhere.

create table if not exists events (
  id                text primary key,               -- short shareable slug
  title             text not null default 'Untitled event',
  admin_name        text not null,                  -- name that owns admin rights (keep-honest)
  weekday_start_min int  not null default 1020,     -- 17:00
  weekday_end_min   int  not null default 1440,     -- 24:00 (midnight)
  weekend_start_min int  not null default 660,      -- 11:00
  weekend_end_min   int  not null default 1440,     -- 24:00
  created_at        timestamptz not null default now()
);

create table if not exists event_days (
  event_id text not null references events(id) on delete cascade,
  day      date not null,
  primary key (event_id, day)
);

create table if not exists participants (
  id         bigint generated always as identity primary key,
  event_id   text not null references events(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- one participant per name per event, case-insensitive ("keep honest" login)
create unique index if not exists participants_event_name_ci
  on participants (event_id, lower(name));

-- one row per selected 30-minute chunk
create table if not exists availability (
  participant_id bigint not null references participants(id) on delete cascade,
  day            date   not null,
  start_min      int    not null,                   -- 0..1410, multiple of 30
  primary key (participant_id, day, start_min)
);

create index if not exists availability_participant_idx on availability (participant_id);
create index if not exists participants_event_idx       on participants (event_id);
create index if not exists event_days_event_idx         on event_days (event_id);

-- NOTE: All access goes through the serverless API using the service-role key,
-- so Row Level Security is intentionally left off. Do NOT expose the anon key
-- with write access to these tables from the browser.
