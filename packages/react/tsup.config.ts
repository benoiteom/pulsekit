import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.{ts,tsx}", "!src/__tests__/**"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  bundle: false,
  outExtension: () => ({ js: ".mjs", dts: ".d.ts" }),
  external: ["react", "react-day-picker", "recharts", "@supabase/supabase-js", "@pulsekit/core", "next", "next/headers", "next/navigation"],
});
