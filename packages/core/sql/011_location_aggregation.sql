-- 011_location_aggregation.sql
--
-- Adds location aggregation so geo/map data survives the 30-day retention
-- window. Follows the same pattern as referrer aggregation in 010.
--
-- 1. Create pulse_location_aggregates table
-- 2. Update pulse_consolidate_and_cleanup to archive location data (Step 1c)
-- 3. Rewrite pulse_location_stats to union raw events + aggregates (dual-source)

-- ── 1. Location aggregates table ────────────────────────────────────
-- Stores daily location rollups for dates that have been purged from raw events.
-- city is normalized to '' for NULL values, matching the GROUP BY output.

CREATE TABLE IF NOT EXISTS analytics.pulse_location_aggregates (
  date             date             NOT NULL,
  site_id          text             NOT NULL,
  country          text             NOT NULL,
  city             text             NOT NULL DEFAULT '',
  latitude         double precision NOT NULL DEFAULT 0,
  longitude        double precision NOT NULL DEFAULT 0,
  total_views      bigint           NOT NULL DEFAULT 0,
  unique_visitors  bigint           NOT NULL DEFAULT 0,
  PRIMARY KEY (date, site_id, country, city)
);

ALTER TABLE analytics.pulse_location_aggregates ENABLE ROW LEVEL SECURITY;

-- authenticated users (dashboard) can read aggregates
CREATE POLICY "Allow authenticated select on pulse_location_aggregates"
  ON analytics.pulse_location_aggregates
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON analytics.pulse_location_aggregates TO authenticated;
GRANT ALL    ON analytics.pulse_location_aggregates TO service_role;

-- ── 2. Update pulse_consolidate_and_cleanup ─────────────────────────
-- Adds Step 1c: archive location data into pulse_location_aggregates
-- before deleting old events. Replaces the version from 010.

CREATE OR REPLACE FUNCTION analytics.pulse_consolidate_and_cleanup(
  retention_days int DEFAULT 30
)
RETURNS TABLE (rows_consolidated bigint, rows_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics
AS $$
DECLARE
  v_cutoff        timestamptz;
  v_consolidated  bigint;
  v_deleted       bigint;
BEGIN
  v_cutoff := now() - make_interval(days => retention_days);

  -- Step 1a: Roll up old pageview events into daily path-level aggregates
  WITH inserted AS (
    INSERT INTO analytics.pulse_aggregates (date, site_id, path, total_views, unique_visitors)
    SELECT
      date_trunc('day', created_at)::date AS date,
      site_id,
      path,
      count(*)::bigint                   AS total_views,
      count(DISTINCT session_id)::bigint AS unique_visitors
    FROM analytics.pulse_events
    WHERE created_at < v_cutoff
      AND event_type = 'pageview'
    GROUP BY 1, 2, 3
    ON CONFLICT (date, site_id, path) DO UPDATE SET
      total_views     = GREATEST(analytics.pulse_aggregates.total_views,     excluded.total_views),
      unique_visitors = GREATEST(analytics.pulse_aggregates.unique_visitors, excluded.unique_visitors)
    RETURNING 1
  )
  SELECT count(*) INTO v_consolidated FROM inserted;

  -- Step 1b: Roll up old pageview events into daily referrer aggregates
  INSERT INTO analytics.pulse_referrer_aggregates (date, site_id, referrer, total_views, unique_visitors)
  SELECT
    date_trunc('day', created_at)::date              AS date,
    site_id,
    COALESCE(NULLIF(referrer, ''), '(direct)')       AS referrer,
    count(*)                                         AS total_views,
    count(DISTINCT session_id)                       AS unique_visitors
  FROM analytics.pulse_events
  WHERE created_at < v_cutoff
    AND event_type = 'pageview'
  GROUP BY 1, 2, 3
  ON CONFLICT (date, site_id, referrer) DO UPDATE SET
    total_views     = GREATEST(analytics.pulse_referrer_aggregates.total_views,     excluded.total_views),
    unique_visitors = GREATEST(analytics.pulse_referrer_aggregates.unique_visitors, excluded.unique_visitors);

  -- Step 1c: Roll up old pageview events into daily location aggregates
  INSERT INTO analytics.pulse_location_aggregates (date, site_id, country, city, latitude, longitude, total_views, unique_visitors)
  SELECT
    date_trunc('day', created_at)::date AS date,
    site_id,
    country,
    COALESCE(city, '')                  AS city,
    avg(latitude)                       AS latitude,
    avg(longitude)                      AS longitude,
    count(*)                            AS total_views,
    count(DISTINCT session_id)          AS unique_visitors
  FROM analytics.pulse_events
  WHERE created_at < v_cutoff
    AND event_type = 'pageview'
    AND country IS NOT NULL
  GROUP BY 1, 2, 3, 4
  ON CONFLICT (date, site_id, country, city) DO UPDATE SET
    total_views     = GREATEST(analytics.pulse_location_aggregates.total_views,     excluded.total_views),
    unique_visitors = GREATEST(analytics.pulse_location_aggregates.unique_visitors, excluded.unique_visitors),
    latitude        = excluded.latitude,
    longitude       = excluded.longitude;

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

-- ── 3. Rewrite pulse_location_stats — dual-source ──────────────────
-- Follows the same pattern as pulse_referrer_stats (010) and
-- pulse_stats_by_timezone (007):
--   - Dates before the oldest raw event → served from pulse_location_aggregates
--   - Dates covered by raw events       → served from pulse_events directly
-- This ensures location/map data is available regardless of the retention window.

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
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = analytics
AS $$
  WITH
    -- Earliest raw pageview date for this site (boundary between raw and archived data)
    oldest_raw AS (
      SELECT min(date_trunc('day', created_at)::date) AS min_date
      FROM analytics.pulse_events
      WHERE site_id = p_site_id
        AND event_type = 'pageview'
    ),
    -- Historical location data from aggregates (dates before oldest raw event)
    from_aggregates AS (
      SELECT
        l.country,
        l.city,
        l.latitude,
        l.longitude,
        l.total_views::bigint,
        l.unique_visitors::bigint
      FROM analytics.pulse_location_aggregates l, oldest_raw o
      WHERE l.site_id = p_site_id
        AND l.date >= COALESCE(p_start_date, current_date - 7)
        AND l.date <  COALESCE(p_end_date,   current_date) + 1
        AND (o.min_date IS NULL OR l.date < o.min_date)
    ),
    -- Recent location data from raw events
    from_raw AS (
      SELECT
        country,
        city,
        avg(latitude)              AS latitude,
        avg(longitude)             AS longitude,
        count(*)                   AS total_views,
        count(DISTINCT session_id) AS unique_visitors
      FROM analytics.pulse_events
      WHERE site_id = p_site_id
        AND event_type = 'pageview'
        AND country IS NOT NULL
        AND created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
        AND created_at <  (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
      GROUP BY country, city
    )
  SELECT
    country,
    NULLIF(city, '')             AS city,
    sum(latitude * total_views) / NULLIF(sum(total_views), 0)  AS latitude,
    sum(longitude * total_views) / NULLIF(sum(total_views), 0) AS longitude,
    sum(total_views)::bigint     AS total_views,
    sum(unique_visitors)::bigint AS unique_visitors
  FROM (
    SELECT * FROM from_aggregates
    UNION ALL
    SELECT * FROM from_raw
  ) combined
  GROUP BY country, city
  ORDER BY total_views DESC;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_location_stats(text, date, date)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION analytics.pulse_location_stats(text, date, date) FROM anon;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
