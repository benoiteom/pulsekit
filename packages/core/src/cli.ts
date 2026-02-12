import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { max: 1 });
  const sqlDir = path.join(__dirname, "../sql");
  const files = fs
    .readdirSync(sqlDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const text = fs.readFileSync(path.join(sqlDir, file), "utf8");
    await sql.unsafe(text);
    console.log(`Applied: ${file}`);
  }

  await sql.end();
  console.log("Pulse migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
