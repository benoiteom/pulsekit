import type { SupabaseClient } from "@supabase/supabase-js";
import type { PulseEventPayload } from "@pulsekit/core";

export interface PulseHandlerConfig {
  supabase: SupabaseClient;
  config?: {
    allowLocalhost?: boolean;
    ignorePaths?: string[];
    siteId?: string;
  };
}

export interface PulseRequestBody extends PulseEventPayload {
  siteId?: string;
}
