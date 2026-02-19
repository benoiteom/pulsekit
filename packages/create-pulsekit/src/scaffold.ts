import fs from "node:fs";
import path from "node:path";
import { getAppDir } from "./detect";

export function scaffoldFiles(): void {
  console.log("  Scaffolding files...\n");

  const appDir = getAppDir();

  const pulseRoute = `import { createPulseHandler } from "@pulsekit/next";
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
`;

  const refreshRoute = `import { createRefreshHandler, withPulseAuth } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const POST = withPulseAuth(createRefreshHandler({ supabase }));
`;

  const consolidateRoute = `import { createConsolidateHandler, withPulseAuth } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const POST = withPulseAuth(createConsolidateHandler({ supabase }));
`;

  const authRoute = `import { createPulseAuthHandler } from "@pulsekit/next";

const handler = createPulseAuthHandler({ secret: process.env.PULSE_SECRET! });

export const POST = handler;
export const DELETE = handler;
`;

  const dashboardPage = `import { Suspense } from "react";
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
      <PulseAuthGate secret={process.env.PULSE_SECRET}>
        <Dashboard />
      </PulseAuthGate>
    </Suspense>
  );
}
`;

  // Scaffold the spinner component if not already present
  const spinnerContent = `import { LoaderIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
`;

  const cwd = process.cwd();
  const componentsBase = appDir.includes(path.join("src", "app"))
    ? path.join(cwd, "src", "components", "ui")
    : path.join(cwd, "components", "ui");

  const spinnerPath = path.join(componentsBase, "spinner.tsx");
  fs.mkdirSync(componentsBase, { recursive: true });
  if (fs.existsSync(spinnerPath)) {
    console.log("    Skipped (already exists): components/ui/spinner.tsx");
  } else {
    fs.writeFileSync(spinnerPath, spinnerContent, "utf8");
    console.log("    Created: components/ui/spinner.tsx");
  }

  const files = [
    { rel: "api/pulse/route.ts", content: pulseRoute },
    { rel: "api/pulse/auth/route.ts", content: authRoute },
    { rel: "api/pulse/refresh-aggregates/route.ts", content: refreshRoute },
    { rel: "api/pulse/consolidate/route.ts", content: consolidateRoute },
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
