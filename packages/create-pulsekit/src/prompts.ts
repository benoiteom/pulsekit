import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

export interface PulseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  databaseUrl: string;
  siteId: string;
}

function readEnvFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
  }
  return env;
}

export async function promptForConfig(): Promise<PulseConfig> {
  const env = readEnvFile();
  const rl = readline.createInterface({ input, output });

  try {
    // Supabase URL
    const detectedUrl = env["NEXT_PUBLIC_SUPABASE_URL"] || "";
    let supabaseUrl: string;
    if (detectedUrl) {
      const answer = await rl.question(`  Supabase URL [${detectedUrl}]: `);
      supabaseUrl = answer.trim() || detectedUrl;
    } else {
      supabaseUrl = (await rl.question("  Supabase URL: ")).trim();
      if (!supabaseUrl) throw new Error("Supabase URL is required.");
    }

    // Supabase anon key
    const detectedKey =
      env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
      env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"] ||
      "";
    let supabaseAnonKey: string;
    if (detectedKey) {
      const masked = detectedKey.slice(0, 10) + "..." + detectedKey.slice(-4);
      const answer = await rl.question(`  Supabase anon key [${masked}]: `);
      supabaseAnonKey = answer.trim() || detectedKey;
    } else {
      supabaseAnonKey = (await rl.question("  Supabase anon key: ")).trim();
      if (!supabaseAnonKey) throw new Error("Supabase anon key is required.");
    }

    // DATABASE_URL
    const detectedDb = env["DATABASE_URL"] || "";
    let databaseUrl: string;
    if (detectedDb) {
      const masked = detectedDb.slice(0, 15) + "..." + detectedDb.slice(-10);
      const answer = await rl.question(`  DATABASE_URL [${masked}]: `);
      databaseUrl = answer.trim() || detectedDb;
    } else {
      databaseUrl = (
        await rl.question("  DATABASE_URL (postgres://...): ")
      ).trim();
      if (!databaseUrl)
        throw new Error("DATABASE_URL is required for migrations.");
    }

    // Site ID
    const siteIdAnswer = await rl.question("  Site ID [default]: ");
    const siteId = siteIdAnswer.trim() || "default";

    return { supabaseUrl, supabaseAnonKey, databaseUrl, siteId };
  } finally {
    rl.close();
  }
}
