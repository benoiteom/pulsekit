import fs from "node:fs";
import path from "node:path";
import { detectPackageManager, validateNextJsProject } from "./detect";
import { installPackages } from "./install";
import { scaffoldFiles } from "./scaffold";
import { injectPulseTracker } from "./inject";
import { injectInstrumentation } from "./inject-instrumentation";
import { writeMigration } from "./migration";

function appendEnvExample(): void {
  const envExamplePath = path.join(process.cwd(), ".env.example");
  if (!fs.existsSync(envExamplePath)) return;

  const content = fs.readFileSync(envExamplePath, "utf8");
  const entries: { key: string; value: string }[] = [
    { key: "PULSE_SECRET", value: "" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: "" },
  ];

  const missing = entries.filter((e) => !content.includes(e.key));
  if (missing.length === 0) return;

  const block =
    "\n# PulseKit\n" +
    missing.map((e) => `${e.key}=${e.value}`).join("\n") +
    "\n";
  fs.appendFileSync(envExamplePath, block, "utf8");
  console.log("  Updated .env.example with PulseKit variables.\n");
}

async function main() {
  console.log("\n  create-pulsekit\n");
  console.log("  Setting up PulseKit analytics in your Next.js project.\n");

  const pm = detectPackageManager();
  console.log(`  Detected package manager: ${pm}\n`);

  validateNextJsProject();

  await installPackages(pm);

  scaffoldFiles();

  await injectPulseTracker();

  await injectInstrumentation();

  writeMigration();

  appendEnvExample();

  console.log("\n  Done! PulseKit has been added to your project.\n");
  console.log("  To finish setup:");
  console.log("    1. Add these variables to .env.local:");
  console.log("       NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>");
  console.log("       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>");
  console.log("       SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>");
  console.log("       PULSE_SECRET=<a-random-string-at-least-16-chars>");
  console.log("    2. Run the database migration:");
  console.log("       npx supabase link");
  console.log("       npx supabase db push");
  console.log("    3. If your middleware protects routes (e.g. Supabase auth),");
  console.log("       allow the PulseKit paths through:");
  console.log('       !request.nextUrl.pathname.startsWith("/api/pulse")');
  console.log('       !request.nextUrl.pathname.startsWith("/admin/analytics")');
  console.log("    4. Start your dev server and visit /admin/analytics\n");
}

main().catch((err) => {
  console.error("\n  Error:", err.message || err);
  process.exit(1);
});
