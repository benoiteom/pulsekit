import { createClient } from "@supabase/supabase-js";
import { createPulseErrorReporter } from "@pulsekit/next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const onRequestError = createPulseErrorReporter({
  supabase,
  siteId: "default",
});
