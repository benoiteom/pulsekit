import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { PulseDashboard, PulseAuthGate } from "@pulsekit/react";
import { getPulseTimezone } from "@pulsekit/next";
import type { Timeframe } from "@pulsekit/core";
import { Spinner } from "@/components/ui/spinner";
import "@pulsekit/react/pulse.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DashboardProps {
  timeframe: Timeframe;
  range: "7d" | "30d";
  tab: string;
  eventType?: string;
  eventPath?: string;
  eventSession?: string;
  eventPage?: number;
}

async function Dashboard(props: DashboardProps) {
  const timezone = await getPulseTimezone();

  return (
    <PulseDashboard
      supabase={supabase}
      siteId="default"
      timezone={timezone}
      {...props}
    />
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    tab?: string;
    range?: string;
    eventType?: string;
    eventPath?: string;
    eventSession?: string;
    eventPage?: string;
  }>;
}) {
  const params = await searchParams;
  const timeframe: Timeframe = params.from && params.to ? { from: params.from, to: params.to } : "7d";

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen p-6"><Spinner className="size-6" /></div>}>
      <PulseAuthGate secret={process.env.PULSE_SECRET!}>
        <Dashboard
          timeframe={timeframe}
          range={params.range === "30d" ? "30d" : "7d"}
          tab={params.tab || "traffic"}
          eventType={params.eventType}
          eventPath={params.eventPath}
          eventSession={params.eventSession}
          eventPage={params.eventPage ? parseInt(params.eventPage, 10) : undefined}
        />
      </PulseAuthGate>
    </Suspense>
  );
}
