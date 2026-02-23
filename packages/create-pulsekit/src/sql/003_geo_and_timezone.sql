-- Add geo columns to pulse_events
alter table analytics.pulse_events
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists timezone text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Timezone-aware stats: queries raw events with AT TIME ZONE
-- so the dashboard can display data bucketed by the viewer's local day.
create or replace function analytics.pulse_stats_by_timezone(
  p_site_id text,
  p_timezone text default 'UTC',
  p_days_back integer default 7
)
returns table (
  date date,
  path text,
  total_views bigint,
  unique_visitors bigint
)
language sql
security definer
stable
set search_path = analytics
as $$
  select
    date_trunc('day', created_at at time zone p_timezone)::date as date,
    path,
    count(*) as total_views,
    count(distinct session_id) as unique_visitors
  from analytics.pulse_events
  where site_id = p_site_id
    and created_at >= now() - make_interval(days => p_days_back + 1)
  group by 1, 2;
$$;

grant execute on function analytics.pulse_stats_by_timezone(text, text, integer)
  to anon, authenticated, service_role;

-- Drop first so return type can change (CREATE OR REPLACE cannot alter return columns)
drop function if exists analytics.pulse_location_stats(text, integer);

-- Location stats: visitor counts grouped by country + city, with averaged coordinates
create or replace function analytics.pulse_location_stats(
  p_site_id text,
  p_days_back integer default 7
)
returns table (
  country text,
  city text,
  latitude double precision,
  longitude double precision,
  total_views bigint,
  unique_visitors bigint
)
language sql
security definer
stable
set search_path = analytics
as $$
  select
    country,
    city,
    avg(latitude) as latitude,
    avg(longitude) as longitude,
    count(*) as total_views,
    count(distinct session_id) as unique_visitors
  from analytics.pulse_events
  where site_id = p_site_id
    and created_at >= now() - make_interval(days => p_days_back)
    and country is not null
  group by 1, 2
  order by total_views desc;
$$;

grant execute on function analytics.pulse_location_stats(text, integer)
  to anon, authenticated, service_role;
