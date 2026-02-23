create schema if not exists analytics;

-- Add analytics to the schemas exposed by PostgREST
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, analytics';

-- Schema-level access
grant usage on schema analytics to anon, authenticated, service_role;
alter default privileges in schema analytics grant select on tables to authenticated;
alter default privileges in schema analytics grant all on tables to service_role;

create table if not exists analytics.pulse_events (
  id bigserial primary key,
  site_id text not null,
  session_id text,
  path text not null,
  event_type text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pulse_events_site_created_at
  on analytics.pulse_events (site_id, created_at);

create index if not exists idx_pulse_events_site_path_created_at
  on analytics.pulse_events (site_id, path, created_at);

alter table analytics.pulse_events enable row level security;                                                                                                                       
                                                                                                                                                                                      
-- Allow the anon key (API route) to insert events
drop policy if exists "Allow anon insert on pulse_events" on analytics.pulse_events;
create policy "Allow anon insert on pulse_events"
  on analytics.pulse_events
  for insert
  to anon
  with check (true);

-- Only authenticated users (dashboard) can read events
drop policy if exists "Allow authenticated select on pulse_events" on analytics.pulse_events;
create policy "Allow authenticated select on pulse_events"
  on analytics.pulse_events
  for select
  to authenticated
  using (true);

create table if not exists analytics.pulse_aggregates (
  date date not null,
  site_id text not null,
  path text not null,
  total_views integer not null default 0,
  unique_visitors integer not null default 0,
  primary key (date, site_id, path)
);

-- Grant table-level access (must be after table creation)
-- anon: INSERT only on pulse_events (used by the ingestion API route)
grant insert on analytics.pulse_events to anon;
grant usage on sequence analytics.pulse_events_id_seq to anon;

-- authenticated: read-only on all analytics tables
grant select on all tables in schema analytics to authenticated;

-- service_role: full access (admin operations, consolidation, etc.)
grant all on all tables in schema analytics to service_role;
grant all on all sequences in schema analytics to service_role;

alter table analytics.pulse_aggregates enable row level security;

-- Allow reading aggregates (dashboard)
drop policy if exists "Allow authenticated select on pulse_aggregates" on analytics.pulse_aggregates;
create policy "Allow authenticated select on pulse_aggregates"
    on analytics.pulse_aggregates
    for select
    to authenticated
    using (true);

-- Reload PostgREST config and schema cache (must be last)
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
