import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RefreshHandlerConfig {
  supabase: SupabaseClient;
  daysBack?: number;
}

export function createRefreshHandler({
  supabase,
  daysBack = 7,
}: RefreshHandlerConfig) {
  return async function handler() {
    const { error } = await supabase
      .schema("analytics")
      .rpc("pulse_refresh_aggregates", { days_back: daysBack });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  };
}
