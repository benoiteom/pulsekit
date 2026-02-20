import { createPulseHandler } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const POST = createPulseHandler({
  supabase,
  config: {
    siteId: "default",
    secret: process.env.PULSE_SECRET,
  },
});
