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
