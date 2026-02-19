import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { PulseDashboard, PulseAuthGate } from "@pulsekit/react";
import { getPulseTimezone } from "@pulsekit/next";
import { Spinner } from "@/components/ui/spinner";
import type { Timeframe } from "@pulsekit/core";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function Dashboard({ timeframe }: { timeframe: Timeframe }) {
  const timezone = await getPulseTimezone();

  return (
    <PulseDashboard
      supabase={supabase}
      siteId="demo"
      timeframe={timeframe}
      timezone={timezone}
    />
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const timeframe: Timeframe = from && to ? { from, to } : "7d";

  return (
    <Suspense fallback={<div className="flex items-center justify-center p-6"><Spinner className="size-6" /></div>}>
      <PulseAuthGate secret={process.env.PULSE_SECRET!}>
        <Dashboard timeframe={timeframe} />
      </PulseAuthGate>
    </Suspense>
  );
}
