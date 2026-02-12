import { detectPackageManager, validateNextJsProject } from "./detect";
import { installPackages } from "./install";
import { scaffoldFiles } from "./scaffold";
import { injectPulseTracker } from "./inject";
import { writeMigration } from "./migration";

async function main() {
  console.log("\n  create-pulsekit\n");
  console.log("  Setting up PulseKit analytics in your Next.js project.\n");

  const pm = detectPackageManager();
  console.log(`  Detected package manager: ${pm}\n`);

  validateNextJsProject();

  await installPackages(pm);

  scaffoldFiles();

  await injectPulseTracker();

  writeMigration();

  console.log("\n  Done! PulseKit has been added to your project.\n");
  console.log("  To finish setup:");
  console.log("    1. Add your Supabase credentials to .env.local:");
  console.log("       NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>");
  console.log("       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>");
  console.log("    2. Run the database migration:");
  console.log("       npx supabase link");
  console.log("       npx supabase db push");
  console.log("    3. Start your dev server and visit /admin/analytics");
}

main().catch((err) => {
  console.error("\n  Error:", err.message || err);
  process.exit(1);
});
