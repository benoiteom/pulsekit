-- Add referrer column
ALTER TABLE analytics.pulse_events
  ADD COLUMN IF NOT EXISTS referrer text;

-- Index for referrer aggregation queries
CREATE INDEX IF NOT EXISTS idx_pulse_events_referrer
  ON analytics.pulse_events (site_id, created_at)
  WHERE event_type = 'pageview' AND referrer IS NOT NULL;

-- RPC: aggregate pageviews by referrer hostname
CREATE OR REPLACE FUNCTION analytics.pulse_referrer_stats(
  p_site_id    text,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (
  referrer         text,
  total_views      bigint,
  unique_visitors  bigint
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = analytics
AS $$
  SELECT
    COALESCE(NULLIF(referrer, ''), '(direct)') AS referrer,
    count(*) AS total_views,
    count(DISTINCT session_id) AS unique_visitors
  FROM analytics.pulse_events
  WHERE site_id = p_site_id
    AND event_type = 'pageview'
    AND created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
    AND created_at < (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
  GROUP BY 1
  ORDER BY total_views DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_referrer_stats(text, date, date)
  TO anon, authenticated, service_role;
