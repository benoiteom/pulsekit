import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["next", "react", "web-vitals"],
  async onSuccess() {
    const clientPath = "./dist/client.mjs";
    const content = readFileSync(clientPath, "utf-8");
    writeFileSync(clientPath, `"use client";\n${content}`);
  },
});
