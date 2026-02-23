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
SET search_path = analytics
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
SET search_path = analytics
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
