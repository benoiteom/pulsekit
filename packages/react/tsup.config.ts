import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  format: ["esm"],
  dts: true,
  clean: true,
  bundle: false,
  outExtension: () => ({ js: ".js", dts: ".d.ts" }),
  external: ["react", "react-day-picker", "recharts", "@supabase/supabase-js", "@pulsekit/core"],
});
