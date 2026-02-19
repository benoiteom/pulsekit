import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["next", "react", "web-vitals"],
  outExtension: () => ({ js: ".mjs", dts: ".d.ts" }),
  async onSuccess() {
    const clientPath = "./dist/client.mjs";
    const content = readFileSync(clientPath, "utf-8");
    writeFileSync(clientPath, `"use client";\n${content}`);
  },
});
