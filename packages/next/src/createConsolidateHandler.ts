import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConsolidateHandlerConfig {
  supabase: SupabaseClient;
  retentionDays?: number;
}

export function createConsolidateHandler({
  supabase,
  retentionDays = 30,
}: ConsolidateHandlerConfig) {
  return async function handler() {
    const { data, error } = await supabase
      .schema("analytics")
      .rpc("pulse_consolidate_and_cleanup", {
        retention_days: retentionDays,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data?.[0] ?? {
      rows_consolidated: 0,
      rows_deleted: 0,
    };

    return NextResponse.json({
      ok: true,
      rowsConsolidated: result.rows_consolidated,
      rowsDeleted: result.rows_deleted,
    });
  };
}
