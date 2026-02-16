import type { SupabaseClient } from "@supabase/supabase-js";
import type { PulseEventPayload } from "@pulsekit/core";

export interface PulseHandlerConfig {
  supabase: SupabaseClient;
  config?: {
    /** Allowed origins for CORS validation. Requests from unlisted origins are rejected. If omitted, all origins are allowed. */
    allowedOrigins?: string[];
    /** Paths to ignore (no events recorded). */
    ignorePaths?: string[];
    /** Default site ID for multi-tenant setups. Defaults to "default". */
    siteId?: string;
    /** Rate limit: max requests per IP within the window. Defaults to 30. */
    rateLimit?: number;
    /** Rate limit window in seconds. Defaults to 60. */
    rateLimitWindow?: number;
  };
}

export interface PulseRequestBody extends PulseEventPayload {
  siteId?: string;
}
