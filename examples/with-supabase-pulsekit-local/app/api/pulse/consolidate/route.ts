import { createConsolidateHandler, withPulseAuth } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const handler = withPulseAuth(createConsolidateHandler({ supabase }));
export const GET = handler;
export const POST = handler;
