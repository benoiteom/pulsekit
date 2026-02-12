import { detectPackageManager, validateNextJsProject } from "./detect";
import { promptForConfig } from "./prompts";
import { installPackages } from "./install";
import { runMigrations } from "./migrate";
import { scaffoldFiles } from "./scaffold";
import { injectPulseTracker } from "./inject";
import { writeEnvVars } from "./env";

async function main() {
  console.log("\n  create-pulsekit\n");
  console.log("  Setting up PulseKit analytics in your Next.js project.\n");

  const pm = detectPackageManager();
  console.log(`  Detected package manager: ${pm}\n`);

  validateNextJsProject();

  const config = await promptForConfig();

  writeEnvVars(config);

  await installPackages(pm);

  await runMigrations(config.databaseUrl);

  await scaffoldFiles(config.siteId);

  await injectPulseTracker();

  console.log("\n  Done! PulseKit analytics is ready.\n");
  console.log("  Next steps:");
  console.log("    1. Start your dev server");
  console.log("    2. Visit any page to generate pageview events");
  console.log("    3. Go to /admin/analytics to see your dashboard");
}

main().catch((err) => {
  console.error("\n  Error:", err.message || err);
  process.exit(1);
});
