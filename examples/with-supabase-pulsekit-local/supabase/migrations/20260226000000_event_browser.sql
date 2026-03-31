-- 012_event_browser.sql
--
-- Adds server-side paginated event listing and count RPCs for the
-- dashboard Events tab. Supports filtering by event_type, path,
-- and session_id.

-- ── 1. pulse_events_list ────────────────────────────────────────────
-- Returns a page of raw events, newest first.

CREATE OR REPLACE FUNCTION analytics.pulse_events_list(
  p_site_id      text,
  p_start_date   date    DEFAULT NULL,
  p_end_date     date    DEFAULT NULL,
  p_event_type   text    DEFAULT NULL,
  p_path         text    DEFAULT NULL,
  p_session_id   text    DEFAULT NULL,
  p_limit        int     DEFAULT 50,
  p_offset       int     DEFAULT 0
)
RETURNS TABLE (
  id             bigint,
  event_type     text,
  path           text,
  session_id     text,
  referrer       text,
  country        text,
  city           text,
  meta           jsonb,
  created_at     timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = analytics
AS $$
  SELECT
    e.id,
    e.event_type,
    e.path,
    e.session_id,
    e.referrer,
    e.country,
    e.city,
    e.meta,
    e.created_at
  FROM analytics.pulse_events e
  WHERE e.site_id = p_site_id
    AND e.created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
    AND e.created_at <  (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
    AND (p_event_type IS NULL OR e.event_type = p_event_type)
    AND (p_path IS NULL OR e.path = p_path)
    AND (p_session_id IS NULL OR e.session_id = p_session_id)
  ORDER BY e.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_events_list(text, date, date, text, text, text, int, int)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION analytics.pulse_events_list(text, date, date, text, text, text, int, int)
  FROM anon;

-- ── 2. pulse_events_count ───────────────────────────────────────────
-- Returns total matching row count for pagination.

CREATE OR REPLACE FUNCTION analytics.pulse_events_count(
  p_site_id      text,
  p_start_date   date    DEFAULT NULL,
  p_end_date     date    DEFAULT NULL,
  p_event_type   text    DEFAULT NULL,
  p_path         text    DEFAULT NULL,
  p_session_id   text    DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = analytics
AS $$
  SELECT count(*)
  FROM analytics.pulse_events e
  WHERE e.site_id = p_site_id
    AND e.created_at >= COALESCE(p_start_date, current_date - 7)::timestamptz
    AND e.created_at <  (COALESCE(p_end_date, current_date) + interval '1 day')::timestamptz
    AND (p_event_type IS NULL OR e.event_type = p_event_type)
    AND (p_path IS NULL OR e.path = p_path)
    AND (p_session_id IS NULL OR e.session_id = p_session_id);
$$;

GRANT EXECUTE ON FUNCTION analytics.pulse_events_count(text, date, date, text, text, text)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION analytics.pulse_events_count(text, date, date, text, text, text)
  FROM anon;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
