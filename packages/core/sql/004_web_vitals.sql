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
SET search_path = analytics
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
