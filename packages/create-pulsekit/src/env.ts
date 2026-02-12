import fs from "node:fs";
import path from "node:path";
import type { PulseConfig } from "./prompts";

export function writeEnvVars(config: PulseConfig): void {
  console.log("  Updating .env.local...\n");

  const envPath = path.join(process.cwd(), ".env.local");
  let existing = "";
  if (fs.existsSync(envPath)) {
    existing = fs.readFileSync(envPath, "utf8");
  }

  const lines: string[] = [];

  if (!existing.includes("NEXT_PUBLIC_SUPABASE_URL")) {
    lines.push(`NEXT_PUBLIC_SUPABASE_URL=${config.supabaseUrl}`);
  }
  if (
    !existing.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    !existing.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY")
  ) {
    lines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${config.supabaseAnonKey}`);
  }
  if (!existing.includes("DATABASE_URL")) {
    lines.push(`DATABASE_URL=${config.databaseUrl}`);
  }

  if (lines.length === 0) {
    console.log("    .env.local already has all required variables.\n");
    return;
  }

  const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
  const addition =
    separator + "\n# PulseKit Analytics\n" + lines.join("\n") + "\n";

  fs.appendFileSync(envPath, addition, "utf8");
  console.log("    Updated .env.local with PulseKit variables.\n");
}
