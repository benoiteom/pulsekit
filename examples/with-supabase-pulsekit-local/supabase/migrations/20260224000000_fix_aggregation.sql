-- 010_fix_aggregation.sql
--
-- Fixes two bugs:
--
-- Bug #1 — pulse_refresh_aggregates used ON CONFLICT DO UPDATE SET col = excluded.col,
--   which overwrites existing aggregates instead of keeping the higher value. If a
--   partial refresh runs (smaller window, or consolidation deleted some raw events
--   before refresh completed), it could silently reduce counts. Fix: use GREATEST().
--
-- Bug #3 — pulse_referrer_stats only queries raw pulse_events. Once
--   pulse_consolidate_and_cleanup deletes events beyond the retention window, referrer
--   data for those dates is permanently lost and the dashboard silently returns
--   incomplete results for longer date ranges.
--   Fix: add pulse_referrer_aggregates table, archive referrer data during
--   consolidation, and rewrite pulse_referrer_stats to union raw + aggregates
--   (same pattern as pulse_stats_by_timezone in 007_data_lifecycle.sql).

-- ── 1. Fix pulse_refresh_aggregates (Bug #1) ─────────────────────────────
-- Replace overwrite with GREATEST() so repeated calls within a day never
-- reduce a count that was already correct.

CREATE OR REPLACE FUNCTION analytics.pulse_refresh_aggregates(days_back integer DEFAULT 7)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = analytics
AS $$
  INSERT INTO analytics.pulse_aggregates (date, site_id, path, total_views, unique_visitors)
  SELECT
    date_trunc('day', created_at)::date AS date,
    site_id,
    path,
    count(*)                    AS total_views,
    count(DISTINCT session_id)  AS unique_visitors
  FROM analytics.pulse_events
  WHERE created_at >= now() - (days_back || ' days')::interval
    AND event_type = 'pageview'
  GROUP BY 1, 2, 3
  ON CONFLICT (date, site_id, path) DO UPDATE SET
    total_views     = GREATEST(analytics.pulse_aggregates.total_views,     excluded.total_views),
    unique_visitors = GREATEST(analytics.pulse_aggregates.unique_visitors, excluded.unique_visitors);
$$;

-- ── 2. Referrer aggregates table (Bug #3) ────────────────────────────────
-- Stores daily referrer rollups for dates that have been purged from raw events.
-- referrer is normalized to '(direct)' for null/empty values, matching the RPC output.

CREATE TABLE IF NOT EXISTS analytics.pulse_referrer_aggregates (
  date             date   NOT NULL,
  site_id          text   NOT NULL,
  referrer         text   NOT NULL,
  total_views      bigint NOT NULL DEFAULT 0,
  unique_visitors  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (date, site_id, referrer)
);

ALTER TABLE analytics.pulse_referrer_aggregates ENABLE ROW LEVEL SECURITY;

-- authenticated users (dashboard) can read aggregates
CREATE POLICY "Allow authenticated select on pulse_referrer_aggregates"
  ON analytics.pulse_referrer_aggregates
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON analytics.pulse_referrer_aggregates TO authenticated;
GRANT ALL    ON analytics.pulse_referrer_aggregates TO service_role;

-- ── 3. Update pulse_consolidate_and_cleanup to archive referrer data ──────
-- Adds Step 1b: before deleting old events, roll up referrer counts into
-- pulse_referrer_aggregates. Uses GREATEST() for idempotent re-runs.

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
  -- NOTE: unique_visitors here is per-day distinct sessions. Summing across
  -- multiple days will over-count visitors who appeared on more than one day,
  -- but this is an inherent limitation of pre-aggregation and matches the
  -- approximation already used in pulse_aggregates.
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

-- ── 4. Rewrite pulse_referrer_stats to union raw events + aggregates ──────
-- Follows the same pattern as pulse_stats_by_timezone (007_data_lifecycle.sql):
--   - Dates before the oldest raw event → served from pulse_referrer_aggregates
--   - Dates covered by raw events       → served from pulse_events directly
-- This ensures referrer data is available regardless of the retention window.

CREATE OR REPLACE FUNCTION analytics.pulse_referrer_stats(
  p_site_id    text,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (
  referrer        text,
  total_views     bigint,
  unique_visitors bigint
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
    -- Historical referrer data from aggregates (dates before oldest raw event)
    from_aggregates AS (
      SELECT
        r.referrer,
        r.total_views::bigint,
        r.unique_visitors::bigint
      FROM analytics.pulse_referrer_aggregates r, oldest_raw o
      WHERE r.site_id = p_site_id
        AND r.date >= COALESCE(p_start_date, current_date - 7)
        AND r.date <  COALESCE(p_end_date,   current_date) + 1
        AND (o.min_date IS NULL OR r.date < o.min_date)
    ),
    -- Recent referrer data from raw events
    from_raw AS (
      SELECT
        COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer,
        count(*)                                   AS total_views,
        count(DISTINCT session_id)                 AS unique_visitors
      FROM analytics.pulse_events
      WHERE site_id = p_site_id
        AND event_type = 'pageview'
        AND created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
        AND created_at <  (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
      GROUP BY 1
    )
  SELECT
    referrer,
    sum(total_views)::bigint     AS total_views,
    sum(unique_visitors)::bigint AS unique_visitors
  FROM (
    SELECT * FROM from_aggregates
    UNION ALL
    SELECT * FROM from_raw
  ) combined
  GROUP BY referrer
  ORDER BY total_views DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_referrer_stats(text, date, date)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION analytics.pulse_referrer_stats(text, date, date) FROM anon;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
