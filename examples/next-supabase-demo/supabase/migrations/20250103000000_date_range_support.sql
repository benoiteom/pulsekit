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
