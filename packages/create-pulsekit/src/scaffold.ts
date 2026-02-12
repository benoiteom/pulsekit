import fs from "node:fs";
import path from "node:path";
import { getAppDir } from "./detect";

export async function scaffoldFiles(siteId: string): Promise<void> {
  console.log("  Scaffolding files...\n");

  const appDir = getAppDir();

  const pulseRoute = `import { createPulseHandler } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const POST = createPulseHandler({
  supabase,
  config: {
    allowLocalhost: true,
    siteId: ${JSON.stringify(siteId)},
  },
});
`;

  const refreshRoute = `import { createRefreshHandler } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const POST = createRefreshHandler({ supabase });
`;

  const dashboardPage = `import { createClient } from "@supabase/supabase-js";
import { PulseDashboard } from "@pulsekit/react";
import { getPulseTimezone } from "@pulsekit/next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function AnalyticsPage() {
  const timezone = await getPulseTimezone();

  return (
    <PulseDashboard
      supabase={supabase}
      siteId={${JSON.stringify(siteId)}}
      timeframe="7d"
      timezone={timezone}
    />
  );
}
`;

  const files = [
    { rel: "api/pulse/route.ts", content: pulseRoute },
    { rel: "api/pulse/refresh-aggregates/route.ts", content: refreshRoute },
    { rel: "admin/analytics/page.tsx", content: dashboardPage },
  ];

  for (const { rel, content } of files) {
    const fullPath = path.join(appDir, rel);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    if (fs.existsSync(fullPath)) {
      console.log(`    Skipped (already exists): ${rel}`);
      continue;
    }

    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`    Created: ${rel}`);
  }

  console.log("");
}
