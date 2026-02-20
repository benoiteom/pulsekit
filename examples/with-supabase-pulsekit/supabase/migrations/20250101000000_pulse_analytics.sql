-- 001_init_pulse.sql
create schema if not exists analytics;

-- Add analytics to the schemas exposed by PostgREST
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, analytics';

-- Schema-level access
grant usage on schema analytics to anon, authenticated, service_role;
alter default privileges in schema analytics grant all on tables to anon, authenticated, service_role;

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
grant all on all tables in schema analytics to anon, authenticated, service_role;
grant all on all sequences in schema analytics to anon, authenticated, service_role;

alter table analytics.pulse_aggregates enable row level security;

-- Allow reading aggregates (dashboard)
drop policy if exists "Allow authenticated select on pulse_aggregates" on analytics.pulse_aggregates;
create policy "Allow authenticated select on pulse_aggregates"
    on analytics.pulse_aggregates
    for select
    to authenticated
    using (true);

drop policy if exists "Allow anon select on pulse_aggregates" on analytics.pulse_aggregates;
create policy "Allow anon select on pulse_aggregates"
    on analytics.pulse_aggregates
    for select
    to anon
    using (true);

-- Reload PostgREST config and schema cache (must be last)
notify pgrst, 'reload config';
notify pgrst, 'reload schema';


-- 002_aggregation_function.sql
-- Aggregation function: rolls up raw events into daily aggregates
create or replace function analytics.pulse_refresh_aggregates(days_back integer default 7)
returns void
language sql
security definer
as $$
  insert into analytics.pulse_aggregates (date, site_id, path, total_views, unique_visitors)
  select
    date_trunc('day', created_at)::date as date,
    site_id,
    path,
    count(*) as total_views,
    count(distinct session_id) as unique_visitors
  from analytics.pulse_events
  where created_at >= now() - (days_back || ' days')::interval
  group by 1, 2, 3
  on conflict (date, site_id, path) do update
  set
    total_views = excluded.total_views,
    unique_visitors = excluded.unique_visitors;
$$;

-- Allow all roles to execute the aggregation function
-- security definer ensures it runs with the owner's privileges regardless of caller
grant execute on function analytics.pulse_refresh_aggregates(integer) to anon, authenticated, service_role;


-- 003_geo_and_timezone.sql
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


-- 004_web_vitals.sql
-- 004_web_vitals.sql
-- Partial index + RPC for Web Vitals p75 aggregation

-- Partial index: only covers vitals events, stays small
CREATE INDEX IF NOT EXISTS idx_pulse_events_vitals
  ON analytics.pulse_events (site_id, created_at)
  WHERE event_type = 'vitals';

-- RPC: returns per-metric p75 for each page + site-wide (__overall__)
CREATE OR REPLACE FUNCTION analytics.pulse_vitals_stats(
  p_site_id  TEXT,
  p_days_back INT DEFAULT 7
)
RETURNS TABLE (
  path         TEXT,
  metric       TEXT,
  p75          DOUBLE PRECISION,
  sample_count BIGINT
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  WITH vitals_raw AS (
    SELECT
      e.path,
      kv.key   AS metric,
      kv.value::double precision AS val
    FROM analytics.pulse_events e,
         LATERAL jsonb_each_text(e.meta) AS kv(key, value)
    WHERE e.site_id    = p_site_id
      AND e.event_type = 'vitals'
      AND e.created_at >= NOW() - (p_days_back || ' days')::interval
      AND kv.key IN ('lcp', 'inp', 'cls', 'fcp', 'ttfb')
  )
  -- Per-page stats
  SELECT
    vr.path,
    vr.metric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY vr.val) AS p75,
    count(*)::bigint AS sample_count
  FROM vitals_raw vr
  GROUP BY vr.path, vr.metric

  UNION ALL

  -- Site-wide stats
  SELECT
    '__overall__'::text AS path,
    vr.metric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY vr.val) AS p75,
    count(*)::bigint AS sample_count
  FROM vitals_raw vr
  GROUP BY vr.metric;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_vitals_stats(TEXT, INT)
  TO anon, authenticated, service_role;


-- 005_error_tracking.sql
-- 005_error_tracking.sql
-- Fix existing RPCs to filter by event_type = 'pageview', add error tracking

-- ── Fix pulse_refresh_aggregates: only aggregate pageview events ──────
CREATE OR REPLACE FUNCTION analytics.pulse_refresh_aggregates(days_back integer default 7)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO analytics.pulse_aggregates (date, site_id, path, total_views, unique_visitors)
  SELECT
    date_trunc('day', created_at)::date AS date,
    site_id,
    path,
    count(*) AS total_views,
    count(distinct session_id) AS unique_visitors
  FROM analytics.pulse_events
  WHERE created_at >= now() - (days_back || ' days')::interval
    AND event_type = 'pageview'
  GROUP BY 1, 2, 3
  ON CONFLICT (date, site_id, path) DO UPDATE
  SET
    total_views = excluded.total_views,
    unique_visitors = excluded.unique_visitors;
$$;

-- ── Fix pulse_stats_by_timezone: only count pageview events ───────────
CREATE OR REPLACE FUNCTION analytics.pulse_stats_by_timezone(
  p_site_id text,
  p_timezone text default 'UTC',
  p_days_back integer default 7
)
RETURNS TABLE (
  date date,
  path text,
  total_views bigint,
  unique_visitors bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    date_trunc('day', created_at AT TIME ZONE p_timezone)::date AS date,
    path,
    count(*) AS total_views,
    count(distinct session_id) AS unique_visitors
  FROM analytics.pulse_events
  WHERE site_id = p_site_id
    AND created_at >= now() - make_interval(days => p_days_back + 1)
    AND event_type = 'pageview'
  GROUP BY 1, 2;
$$;

-- ── Fix pulse_location_stats: only count pageview events ─────────────
CREATE OR REPLACE FUNCTION analytics.pulse_location_stats(
  p_site_id text,
  p_days_back integer default 7
)
RETURNS TABLE (
  country text,
  city text,
  latitude double precision,
  longitude double precision,
  total_views bigint,
  unique_visitors bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    country,
    city,
    avg(latitude) AS latitude,
    avg(longitude) AS longitude,
    count(*) AS total_views,
    count(distinct session_id) AS unique_visitors
  FROM analytics.pulse_events
  WHERE site_id = p_site_id
    AND created_at >= now() - make_interval(days => p_days_back)
    AND country IS NOT NULL
    AND event_type = 'pageview'
  GROUP BY 1, 2
  ORDER BY total_views DESC;
$$;

-- ── Partial index for error events ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pulse_events_errors
  ON analytics.pulse_events (site_id, created_at)
  WHERE event_type IN ('error', 'server_error');

-- ── Error stats RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION analytics.pulse_error_stats(
  p_site_id  TEXT,
  p_days_back INT DEFAULT 7
)
RETURNS TABLE (
  error_type   TEXT,
  message      TEXT,
  path         TEXT,
  total_count  BIGINT,
  session_count BIGINT,
  last_seen    TIMESTAMPTZ,
  first_seen   TIMESTAMPTZ,
  sample_meta  JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  WITH ranked AS (
    SELECT
      e.event_type AS error_type,
      e.meta->>'message' AS message,
      e.path,
      count(*) AS total_count,
      count(DISTINCT e.session_id) AS session_count,
      max(e.created_at) AS last_seen,
      min(e.created_at) AS first_seen,
      -- Get the full meta from the most recent occurrence
      (ARRAY_AGG(e.meta ORDER BY e.created_at DESC))[1] AS sample_meta
    FROM analytics.pulse_events e
    WHERE e.site_id = p_site_id
      AND e.event_type IN ('error', 'server_error')
      AND e.created_at >= NOW() - (p_days_back || ' days')::interval
    GROUP BY e.event_type, e.meta->>'message', e.path
  )
  SELECT * FROM ranked
  ORDER BY last_seen DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_error_stats(TEXT, INT)
  TO anon, authenticated, service_role;


-- 006_date_range_support.sql
-- 006_date_range_support.sql
-- Replace p_days_back with p_start_date / p_end_date date range params.
-- Both default to NULL → falls back to last 7 days when not provided.

-- ── pulse_stats_by_timezone ────────────────────────────────────────
DROP FUNCTION IF EXISTS analytics.pulse_stats_by_timezone(text, text, integer);

CREATE OR REPLACE FUNCTION analytics.pulse_stats_by_timezone(
  p_site_id    text,
  p_timezone   text    DEFAULT 'UTC',
  p_start_date date    DEFAULT NULL,
  p_end_date   date    DEFAULT NULL
)
RETURNS TABLE (
  date             date,
  path             text,
  total_views      bigint,
  unique_visitors  bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    date_trunc('day', created_at AT TIME ZONE p_timezone)::date AS date,
    path,
    count(*) AS total_views,
    count(DISTINCT session_id) AS unique_visitors
  FROM analytics.pulse_events
  WHERE site_id = p_site_id
    AND event_type = 'pageview'
    AND created_at >= (COALESCE(p_start_date, current_date - 7)::timestamp AT TIME ZONE p_timezone)
    AND created_at < ((COALESCE(p_end_date, current_date) + interval '1 day')::timestamp AT TIME ZONE p_timezone)
  GROUP BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_stats_by_timezone(text, text, date, date)
  TO anon, authenticated, service_role;

-- ── pulse_location_stats ───────────────────────────────────────────
DROP FUNCTION IF EXISTS analytics.pulse_location_stats(text, integer);

CREATE OR REPLACE FUNCTION analytics.pulse_location_stats(
  p_site_id    text,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (
  country          text,
  city             text,
  latitude         double precision,
  longitude        double precision,
  total_views      bigint,
  unique_visitors  bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    country,
    city,
    avg(latitude) AS latitude,
    avg(longitude) AS longitude,
    count(*) AS total_views,
    count(DISTINCT session_id) AS unique_visitors
  FROM analytics.pulse_events
  WHERE site_id = p_site_id
    AND event_type = 'pageview'
    AND country IS NOT NULL
    AND created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
    AND created_at < (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
  GROUP BY 1, 2
  ORDER BY total_views DESC;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_location_stats(text, date, date)
  TO anon, authenticated, service_role;

-- ── pulse_vitals_stats ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS analytics.pulse_vitals_stats(text, int);

CREATE OR REPLACE FUNCTION analytics.pulse_vitals_stats(
  p_site_id    text,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (
  path         text,
  metric       text,
  p75          double precision,
  sample_count bigint
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  WITH vitals_raw AS (
    SELECT
      e.path,
      kv.key   AS metric,
      kv.value::double precision AS val
    FROM analytics.pulse_events e,
         LATERAL jsonb_each_text(e.meta) AS kv(key, value)
    WHERE e.site_id    = p_site_id
      AND e.event_type = 'vitals'
      AND e.created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
      AND e.created_at < (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
      AND kv.key IN ('lcp', 'inp', 'cls', 'fcp', 'ttfb')
  )
  -- Per-page stats
  SELECT
    vr.path,
    vr.metric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY vr.val) AS p75,
    count(*)::bigint AS sample_count
  FROM vitals_raw vr
  GROUP BY vr.path, vr.metric

  UNION ALL

  -- Site-wide stats
  SELECT
    '__overall__'::text AS path,
    vr.metric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY vr.val) AS p75,
    count(*)::bigint AS sample_count
  FROM vitals_raw vr
  GROUP BY vr.metric;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_vitals_stats(text, date, date)
  TO anon, authenticated, service_role;

-- ── pulse_error_stats ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS analytics.pulse_error_stats(text, int);

CREATE OR REPLACE FUNCTION analytics.pulse_error_stats(
  p_site_id    text,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (
  error_type    text,
  message       text,
  path          text,
  total_count   bigint,
  session_count bigint,
  last_seen     timestamptz,
  first_seen    timestamptz,
  sample_meta   jsonb
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  WITH ranked AS (
    SELECT
      e.event_type AS error_type,
      e.meta->>'message' AS message,
      e.path,
      count(*) AS total_count,
      count(DISTINCT e.session_id) AS session_count,
      max(e.created_at) AS last_seen,
      min(e.created_at) AS first_seen,
      (ARRAY_AGG(e.meta ORDER BY e.created_at DESC))[1] AS sample_meta
    FROM analytics.pulse_events e
    WHERE e.site_id = p_site_id
      AND e.event_type IN ('error', 'server_error')
      AND e.created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
      AND e.created_at < (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
    GROUP BY e.event_type, e.meta->>'message', e.path
  )
  SELECT * FROM ranked
  ORDER BY last_seen DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_error_stats(text, date, date)
  TO anon, authenticated, service_role;


-- 007_data_lifecycle.sql
-- 007_data_lifecycle.sql
-- Automatic data consolidation & cleanup.
-- Rolls pageview counts older than retention_days into pulse_aggregates,
-- then deletes all old raw events (all event types).

CREATE OR REPLACE FUNCTION analytics.pulse_consolidate_and_cleanup(
  retention_days int DEFAULT 30
)
RETURNS TABLE (rows_consolidated bigint, rows_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff timestamptz;
  v_consolidated bigint;
  v_deleted bigint;
BEGIN
  v_cutoff := now() - make_interval(days => retention_days);

  -- Step 1: Roll up old pageview events into daily aggregates
  WITH inserted AS (
    INSERT INTO analytics.pulse_aggregates (date, site_id, path, total_views, unique_visitors)
    SELECT
      date_trunc('day', created_at)::date AS date,
      site_id,
      path,
      count(*)::int AS total_views,
      count(DISTINCT session_id)::int AS unique_visitors
    FROM analytics.pulse_events
    WHERE created_at < v_cutoff
      AND event_type = 'pageview'
    GROUP BY 1, 2, 3
    ON CONFLICT (date, site_id, path) DO UPDATE SET
      total_views     = GREATEST(analytics.pulse_aggregates.total_views, excluded.total_views),
      unique_visitors = GREATEST(analytics.pulse_aggregates.unique_visitors, excluded.unique_visitors)
    RETURNING 1
  )
  SELECT count(*) INTO v_consolidated FROM inserted;

  -- Step 2: Delete all old events (pageviews, vitals, errors, etc.)
  WITH deleted AS (
    DELETE FROM analytics.pulse_events
    WHERE created_at < v_cutoff
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  RETURN QUERY SELECT v_consolidated, v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_consolidate_and_cleanup(int)
  TO anon, authenticated, service_role;

-- ── Replace pulse_stats_by_timezone to union raw events + aggregates ──
DROP FUNCTION IF EXISTS analytics.pulse_stats_by_timezone(text, text, date, date);

CREATE OR REPLACE FUNCTION analytics.pulse_stats_by_timezone(
  p_site_id    text,
  p_timezone   text    DEFAULT 'UTC',
  p_start_date date    DEFAULT NULL,
  p_end_date   date    DEFAULT NULL
)
RETURNS TABLE (
  date             date,
  path             text,
  total_views      bigint,
  unique_visitors  bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH
    -- Find the earliest raw pageview date for this site
    oldest_raw AS (
      SELECT min(date_trunc('day', created_at AT TIME ZONE p_timezone)::date) AS min_date
      FROM analytics.pulse_events
      WHERE site_id = p_site_id
        AND event_type = 'pageview'
    ),
    -- Aggregated data for dates before the oldest raw event
    from_aggregates AS (
      SELECT
        a.date,
        a.path,
        a.total_views::bigint,
        a.unique_visitors::bigint
      FROM analytics.pulse_aggregates a, oldest_raw o
      WHERE a.site_id = p_site_id
        AND a.date >= COALESCE(p_start_date, current_date - 7)
        AND a.date < COALESCE(p_end_date, current_date) + 1
        AND (o.min_date IS NULL OR a.date < o.min_date)
    ),
    -- Raw events for recent data
    from_raw AS (
      SELECT
        date_trunc('day', created_at AT TIME ZONE p_timezone)::date AS date,
        path,
        count(*) AS total_views,
        count(DISTINCT session_id) AS unique_visitors
      FROM analytics.pulse_events
      WHERE site_id = p_site_id
        AND event_type = 'pageview'
        AND created_at >= (COALESCE(p_start_date, current_date - 7)::timestamp AT TIME ZONE p_timezone)
        AND created_at < ((COALESCE(p_end_date, current_date) + interval '1 day')::timestamp AT TIME ZONE p_timezone)
      GROUP BY 1, 2
    )
  SELECT * FROM from_aggregates
  UNION ALL
  SELECT * FROM from_raw;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_stats_by_timezone(text, text, date, date)
  TO anon, authenticated, service_role;


-- 008_security_hardening.sql
-- 008_security_hardening.sql
-- Tighten grants and RLS policies for production security.
-- Replaces the overly broad GRANT ALL from 001_init_pulse.sql with
-- minimum-privilege grants per role.

-- ── 1. Revoke overly broad table/sequence grants ────────────────────

REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA analytics FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM authenticated;

-- ── 2. Grant minimum privileges per role ─────────────────────────────

-- anon: INSERT only on pulse_events (used by the ingestion API route)
GRANT INSERT ON analytics.pulse_events TO anon;
GRANT USAGE ON SEQUENCE analytics.pulse_events_id_seq TO anon;

-- authenticated: read-only on all analytics tables
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO authenticated;

-- service_role: full access (admin operations, consolidation, etc.)
GRANT ALL ON ALL TABLES IN SCHEMA analytics TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA analytics TO service_role;

-- ── 3. Restrict anon insert to valid event types only ────────────────

DROP POLICY IF EXISTS "Allow anon insert on pulse_events" ON analytics.pulse_events;
CREATE POLICY "Allow anon insert on pulse_events"
  ON analytics.pulse_events
  FOR INSERT
  TO anon
  WITH CHECK (
    event_type IN ('pageview', 'custom', 'vitals', 'error', 'server_error')
  );

-- ── 4. Remove anon read access on aggregates (not needed publicly) ───

DROP POLICY IF EXISTS "Allow anon select on pulse_aggregates" ON analytics.pulse_aggregates;

-- ── 5. Revoke RPC execute from anon ──────────────────────────────────
-- Read RPCs should only be callable by authenticated/service_role.
-- The admin dashboard must use the service_role key (server-side only).

REVOKE EXECUTE ON FUNCTION analytics.pulse_stats_by_timezone(text, text, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.pulse_location_stats(text, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.pulse_vitals_stats(text, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION analytics.pulse_error_stats(text, date, date) FROM anon;

-- ── 6. Consolidate/cleanup is admin-only (service_role via cron) ─────

REVOKE EXECUTE ON FUNCTION analytics.pulse_consolidate_and_cleanup(int) FROM anon, authenticated;

-- ── 7. Fix default privileges for future tables ──────────────────────

ALTER DEFAULT PRIVILEGES IN SCHEMA analytics REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT ALL ON TABLES TO service_role;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
