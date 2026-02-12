import fs from "node:fs";
import path from "node:path";

const SQL_MAP: Record<string, string> = JSON.parse(
  process.env.__EMBEDDED_SQL__!
);

export function writeMigration(): void {
  console.log("  Writing database migration...\n");

  const supabaseDir = path.join(process.cwd(), "supabase", "migrations");
  fs.mkdirSync(supabaseDir, { recursive: true });

  // Combine all SQL files into a single migration
  const files = Object.keys(SQL_MAP).sort();
  const combined = files
    .map((file) => `-- ${file}\n${SQL_MAP[file]}`)
    .join("\n\n");

  // Use a fixed timestamp so re-running doesn't create duplicates
  const filename = "20250101000000_pulse_analytics.sql";
  const fullPath = path.join(supabaseDir, filename);

  if (fs.existsSync(fullPath)) {
    console.log(`    Skipped (already exists): supabase/migrations/${filename}\n`);
    return;
  }

  fs.writeFileSync(fullPath, combined, "utf8");
  console.log(`    Created: supabase/migrations/${filename}\n`);
}
