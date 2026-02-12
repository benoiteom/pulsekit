import { execSync } from "node:child_process";
import type { PackageManager } from "./detect";

const PACKAGES = [
  "@pulsekit/core",
  "@pulsekit/next",
  "@pulsekit/react",
  "@supabase/supabase-js@latest",
];

export async function installPackages(pm: PackageManager): Promise<void> {
  console.log("  Installing packages...\n");

  const commands: Record<PackageManager, string> = {
    npm: `npm install ${PACKAGES.join(" ")}`,
    pnpm: `pnpm add ${PACKAGES.join(" ")}`,
    yarn: `yarn add ${PACKAGES.join(" ")}`,
    bun: `bun add ${PACKAGES.join(" ")}`,
  };

  const cmd = commands[pm];
  console.log(`  > ${cmd}\n`);

  try {
    execSync(cmd, { cwd: process.cwd(), stdio: "inherit" });
  } catch {
    throw new Error(
      `Package installation failed. Try running manually:\n  ${cmd}`
    );
  }
}
