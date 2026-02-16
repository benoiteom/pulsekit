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
