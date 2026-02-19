import { defineConfig } from "tsup";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const sqlDir = join(__dirname, "src/sql");
const sqlFiles = readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const sqlMap: Record<string, string> = {};
for (const file of sqlFiles) {
  sqlMap[file] = readFileSync(join(sqlDir, file), "utf8");
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  platform: "node",
  sourcemap: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  define: {
    "process.env.__EMBEDDED_SQL__": JSON.stringify(JSON.stringify(sqlMap)),
  },
});
