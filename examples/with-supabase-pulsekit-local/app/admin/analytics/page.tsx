import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { PulseDashboard, PulseAuthGate } from "@pulsekit/react";
import { getPulseTimezone } from "@pulsekit/next";
import { Spinner } from "@/components/ui/spinner";
import "@pulsekit/react/pulse.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

async function Dashboard() {
  const timezone = await getPulseTimezone();

  return (
    <PulseDashboard
      supabase={supabase}
      siteId="default"
      timeframe="7d"
      timezone={timezone}
    />
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen p-6"><Spinner className="size-6" /></div>}>
      <PulseAuthGate secret={process.env.PULSE_SECRET!}>
        <Dashboard />
      </PulseAuthGate>
    </Suspense>
  );
}
