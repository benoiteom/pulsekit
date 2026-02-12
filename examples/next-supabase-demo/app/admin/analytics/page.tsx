import { createClient } from "@supabase/supabase-js";
import { PulseDashboard } from "@pulsekit/react";
import { getPulseTimezone } from "@pulsekit/next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export default async function AnalyticsPage() {
  const timezone = await getPulseTimezone();

  return (
    <PulseDashboard
      supabase={supabase}
      siteId="demo"
      timeframe="7d"
      timezone={timezone}
    />
  );
}
