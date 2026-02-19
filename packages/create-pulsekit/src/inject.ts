import fs from "node:fs";
import path from "node:path";
import { getAppDir } from "./detect";

export async function injectPulseTracker(): Promise<void> {
  console.log("  Injecting PulseTracker into layout...\n");

  const appDir = getAppDir();

  const candidates = [
    path.join(appDir, "layout.tsx"),
    path.join(appDir, "layout.jsx"),
    path.join(appDir, "layout.js"),
  ];

  let foundPath: string | null = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      foundPath = candidate;
      break;
    }
  }

  if (!foundPath) {
    printManualInstructions();
    return;
  }

  let content = fs.readFileSync(foundPath, "utf8");

  if (content.includes("PulseTrackerWrapper") || content.includes("PulseTracker")) {
    console.log("    PulseTracker already present in layout. Skipping.\n");
    return;
  }

  // Add imports after the last existing import
  const importStatements = [
    'import { Suspense } from "react";',
    'import PulseTrackerWrapper from "@/components/pulse-tracker-wrapper";',
  ];

  const importRegex = /^import\s.+$/gm;
  let lastImportEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }

  // Only add imports that aren't already present
  const newImports = importStatements.filter((stmt) => !content.includes(stmt));
  const importBlock = newImports.join("\n");

  if (importBlock) {
    if (lastImportEnd === -1) {
      content = importBlock + "\n" + content;
    } else {
      content =
        content.slice(0, lastImportEnd) +
        "\n" +
        importBlock +
        content.slice(lastImportEnd);
    }
  }

  // Inject <Suspense><PulseTrackerWrapper /></Suspense> before </body>
  const bodyCloseIndex = content.lastIndexOf("</body>");
  if (bodyCloseIndex === -1) {
    printManualInstructions();
    return;
  }

  // Detect indentation from the </body> line
  const lineStart = content.lastIndexOf("\n", bodyCloseIndex) + 1;
  const indent = content.slice(lineStart, bodyCloseIndex).match(/^\s*/)?.[0] ?? "        ";
  const trackerJsx = [
    `${indent}  <Suspense>`,
    `${indent}    <PulseTrackerWrapper />`,
    `${indent}  </Suspense>`,
  ].join("\n") + "\n";

  content =
    content.slice(0, lineStart) + trackerJsx + content.slice(lineStart);

  fs.writeFileSync(foundPath, content, "utf8");
  console.log(
    `    Modified: ${path.relative(process.cwd(), foundPath)}\n`
  );
}

function printManualInstructions(): void {
  console.log(
    "    Could not auto-inject PulseTracker. Add it manually to your layout:\n"
  );
  console.log('    import { Suspense } from "react";');
  console.log('    import PulseTrackerWrapper from "@/components/pulse-tracker-wrapper";');
  console.log("");
  console.log("    // Add inside your <body> tag:");
  console.log("    <Suspense>");
  console.log("      <PulseTrackerWrapper />");
  console.log("    </Suspense>\n");
}
