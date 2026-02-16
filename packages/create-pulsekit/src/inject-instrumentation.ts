import fs from "node:fs";
import path from "node:path";
import { getAppDir } from "./detect";

const FULL_CONTENT = `import { createClient } from "@supabase/supabase-js";
import { createPulseErrorReporter } from "@pulsekit/next";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const onRequestError = createPulseErrorReporter({
  supabase,
  siteId: "default",
});
`;

const IMPORT_LINE = 'import { createPulseErrorReporter } from "@pulsekit/next";';

const EXPORT_BLOCK = `
export const onRequestError = createPulseErrorReporter({
  supabase,
  siteId: "default",
});
`;

export async function injectInstrumentation(): Promise<void> {
  console.log("  Setting up error reporting instrumentation...\n");

  const appDir = getAppDir();
  // src/app -> src/instrumentation.ts; app/ -> instrumentation.ts
  const useSrc = appDir.includes(path.join("src", "app"));
  const baseDir = useSrc ? path.join(process.cwd(), "src") : process.cwd();

  const candidates = [
    path.join(baseDir, "instrumentation.ts"),
    path.join(baseDir, "instrumentation.js"),
  ];

  let foundPath: string | null = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      foundPath = candidate;
      break;
    }
  }

  // Case 1: No file exists — create it
  if (!foundPath) {
    const targetPath = path.join(baseDir, "instrumentation.ts");
    fs.writeFileSync(targetPath, FULL_CONTENT, "utf8");
    console.log(`    Created: ${path.relative(process.cwd(), targetPath)}\n`);
    return;
  }

  const content = fs.readFileSync(foundPath, "utf8");

  // Case 3: Already has onRequestError — skip
  if (content.includes("onRequestError")) {
    console.log("    onRequestError already present in instrumentation. Skipping.\n");
    console.log("    To add PulseKit error reporting manually, add:\n");
    console.log(`    ${IMPORT_LINE}`);
    console.log("");
    console.log("    export const onRequestError = createPulseErrorReporter({");
    console.log("      supabase,");
    console.log('      siteId: "default",');
    console.log("    });\n");
    return;
  }

  // Case 2: File exists without onRequestError — append
  const importRegex = /^import\s.+$/gm;
  let lastImportEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }

  let updated: string;
  if (lastImportEnd === -1) {
    updated = IMPORT_LINE + "\n" + content + EXPORT_BLOCK;
  } else {
    updated =
      content.slice(0, lastImportEnd) +
      "\n" +
      IMPORT_LINE +
      content.slice(lastImportEnd) +
      EXPORT_BLOCK;
  }

  fs.writeFileSync(foundPath, updated, "utf8");
  console.log(`    Modified: ${path.relative(process.cwd(), foundPath)}\n`);
}
