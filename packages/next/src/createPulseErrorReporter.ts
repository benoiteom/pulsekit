import type { SupabaseClient } from "@supabase/supabase-js";

export interface PulseErrorReporterConfig {
  supabase: SupabaseClient;
  siteId?: string;
}

export function createPulseErrorReporter({ supabase, siteId = "default" }: PulseErrorReporterConfig) {
  return async function onRequestError(
    error: { digest: string; message: string; stack?: string },
    request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
    context: { routerKind: string; routeType: string; routePath: string }
  ): Promise<void> {
    try {
      const message = (error.message ?? "Unknown error").slice(0, 1024);
      const stack = error.stack
        ? error.stack.split("\n").slice(0, 15).join("\n").slice(0, 4096)
        : null;

      await supabase
        .schema("analytics")
        .from("pulse_events")
        .insert({
          site_id: siteId,
          session_id: null,
          path: request.path,
          event_type: "server_error",
          meta: {
            message,
            stack,
            digest: error.digest,
            method: request.method,
            routerKind: context.routerKind,
            routeType: context.routeType,
            routePath: context.routePath,
          },
        });
    } catch {
      // Never let error reporting break the app
    }
  };
}
