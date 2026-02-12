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

  if (content.includes("PulseTracker")) {
    console.log("    PulseTracker already present in layout. Skipping.\n");
    return;
  }

  // Add import after the last existing import
  const importStatement =
    'import { PulseTracker } from "@pulsekit/next/client";';

  const importRegex = /^import\s.+$/gm;
  let lastImportEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }

  if (lastImportEnd === -1) {
    content = importStatement + "\n" + content;
  } else {
    content =
      content.slice(0, lastImportEnd) +
      "\n" +
      importStatement +
      content.slice(lastImportEnd);
  }

  // Inject <PulseTracker /> before </body>
  const bodyCloseIndex = content.lastIndexOf("</body>");
  if (bodyCloseIndex === -1) {
    printManualInstructions();
    return;
  }

  // Detect indentation from the </body> line
  const lineStart = content.lastIndexOf("\n", bodyCloseIndex) + 1;
  const indent = content.slice(lineStart, bodyCloseIndex).match(/^\s*/)?.[0] ?? "        ";
  const trackerJsx = `${indent}  <PulseTracker excludePaths={["/admin/analytics"]} />\n`;

  content =
    content.slice(0, bodyCloseIndex) + trackerJsx + content.slice(bodyCloseIndex);

  fs.writeFileSync(foundPath, content, "utf8");
  console.log(
    `    Modified: ${path.relative(process.cwd(), foundPath)}\n`
  );
}

function printManualInstructions(): void {
  console.log(
    "    Could not auto-inject PulseTracker. Add it manually to your layout:\n"
  );
  console.log('    import { PulseTracker } from "@pulsekit/next/client";');
  console.log("");
  console.log("    // Add inside your <body> tag:");
  console.log(
    '    <PulseTracker excludePaths={["/admin/analytics"]} />\n'
  );
}
