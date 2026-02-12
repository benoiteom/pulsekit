import postgres from "postgres";

const SQL_MAP: Record<string, string> = JSON.parse(
  process.env.__EMBEDDED_SQL__!
);

export async function runMigrations(databaseUrl: string): Promise<void> {
  console.log("  Running SQL migrations...\n");

  const sql = postgres(databaseUrl, { max: 1 });
  const files = Object.keys(SQL_MAP).sort();

  for (const file of files) {
    try {
      await sql.unsafe(SQL_MAP[file]);
      console.log(`    Applied: ${file}`);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("already exists") || msg.includes("duplicate key")) {
        console.log(`    Skipped (already applied): ${file}`);
      } else {
        await sql.end();
        throw new Error(`Migration ${file} failed: ${msg}`);
      }
    }
  }

  await sql.end();
  console.log("\n  Migrations complete.\n");
}
