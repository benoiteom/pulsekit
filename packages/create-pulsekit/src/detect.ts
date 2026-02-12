import fs from "node:fs";
import path from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export function detectPackageManager(): PackageManager {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, "bun.lock")) ||
    fs.existsSync(path.join(cwd, "bun.lockb"))
  ) {
    return "bun";
  }
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

export function validateNextJsProject(): void {
  const cwd = process.cwd();

  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      "No package.json found. Run this command from the root of a Next.js project."
    );
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!allDeps["next"]) {
    throw new Error(
      "next is not listed in package.json. This command requires a Next.js project."
    );
  }

  if (!fs.existsSync(getAppDir())) {
    throw new Error(
      "No app/ directory found. PulseKit requires the Next.js App Router."
    );
  }
}

export function getAppDir(): string {
  const cwd = process.cwd();
  const srcAppDir = path.join(cwd, "src", "app");
  if (fs.existsSync(srcAppDir)) {
    return srcAppDir;
  }
  return path.join(cwd, "app");
}
