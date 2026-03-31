-- 013_system_stats.sql
--
-- Adds a system diagnostics RPC for the dashboard System tab.
-- Returns key-value pairs about pipeline health, aggregation status,
-- and configuration.

CREATE OR REPLACE FUNCTION analytics.pulse_system_stats(p_site_id text)
RETURNS TABLE (stat_key text, stat_value text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = analytics
AS $$
  -- Event counts by type
  SELECT 'total_events', count(*)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id

  UNION ALL
  SELECT 'pageview_count', count(*)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id AND event_type = 'pageview'

  UNION ALL
  SELECT 'vitals_count', count(*)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id AND event_type = 'vitals'

  UNION ALL
  SELECT 'error_count', count(*)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id AND event_type = 'error'

  UNION ALL
  SELECT 'server_error_count', count(*)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id AND event_type = 'server_error'

  UNION ALL
  SELECT 'custom_count', count(*)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id AND event_type = 'custom'

  -- Event time range
  UNION ALL
  SELECT 'oldest_event', min(created_at)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id

  UNION ALL
  SELECT 'newest_event', max(created_at)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id

  -- Aggregate table stats
  UNION ALL
  SELECT 'aggregates_rows', count(*)::text
  FROM analytics.pulse_aggregates WHERE site_id = p_site_id

  UNION ALL
  SELECT 'aggregates_oldest', min(date)::text
  FROM analytics.pulse_aggregates WHERE site_id = p_site_id

  UNION ALL
  SELECT 'aggregates_newest', max(date)::text
  FROM analytics.pulse_aggregates WHERE site_id = p_site_id

  UNION ALL
  SELECT 'referrer_aggregates_rows', count(*)::text
  FROM analytics.pulse_referrer_aggregates WHERE site_id = p_site_id

  UNION ALL
  SELECT 'location_aggregates_rows', count(*)::text
  FROM analytics.pulse_location_aggregates WHERE site_id = p_site_id

  -- Distinct counts
  UNION ALL
  SELECT 'distinct_sessions', count(DISTINCT session_id)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id

  UNION ALL
  SELECT 'distinct_paths', count(DISTINCT path)::text
  FROM analytics.pulse_events WHERE site_id = p_site_id AND event_type = 'pageview';
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_system_stats(text)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION analytics.pulse_system_stats(text) FROM anon;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
