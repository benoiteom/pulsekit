import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

vi.mock("../detect", () => ({
  getAppDir: vi.fn(),
}));

import fs from "node:fs";
import { getAppDir } from "../detect";
import { injectPulseTracker } from "../inject";
import { injectInstrumentation } from "../inject-instrumentation";

const mockedGetAppDir = vi.mocked(getAppDir);

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.readFileSync).mockReset();
  vi.mocked(fs.writeFileSync).mockReset();
  mockedGetAppDir.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(process, "cwd").mockReturnValue("/fake");
  mockedGetAppDir.mockReturnValue("/fake/src/app");
});

// ── injectPulseTracker ─────────────────────────────────────────────

describe("injectPulseTracker", () => {
  const layout = [
    'import type { Metadata } from "next";',
    'import "./globals.css";',
    "",
    "export default function RootLayout({ children }: { children: React.ReactNode }) {",
    "  return (",
    '    <html lang="en">',
    "      <body>",
    "        {children}",
    "      </body>",
    "    </html>",
    "  );",
    "}",
  ].join("\n");

  it("adds import after last import and JSX before </body>", async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === "/fake/src/app/layout.tsx"
    );
    vi.mocked(fs.readFileSync).mockReturnValue(layout as any);

    await injectPulseTracker();

    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;

    // Import added after the last original import
    expect(written).toContain(
      'import "./globals.css";\nimport { PulseTracker } from "@pulsekit/next/client";'
    );

    // PulseTracker JSX appears before </body>
    const trackerIdx = written.indexOf("<PulseTracker");
    const bodyIdx = written.indexOf("</body>");
    expect(trackerIdx).toBeGreaterThan(-1);
    expect(trackerIdx).toBeLessThan(bodyIdx);
  });

  it("skips when PulseTracker is already present", async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === "/fake/src/app/layout.tsx"
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      layout.replace('import "./globals.css";', 'import { PulseTracker } from "@pulsekit/next/client";') as any
    );

    await injectPulseTracker();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("prints manual instructions when no layout file found", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await injectPulseTracker();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Could not auto-inject")
    );
  });

  it("prepends import when file has no existing imports", async () => {
    const noImports = [
      "export default function RootLayout({ children }: { children: React.ReactNode }) {",
      "  return (",
      '    <html lang="en">',
      "      <body>",
      "        {children}",
      "      </body>",
      "    </html>",
      "  );",
      "}",
    ].join("\n");

    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === "/fake/src/app/layout.tsx"
    );
    vi.mocked(fs.readFileSync).mockReturnValue(noImports as any);

    await injectPulseTracker();

    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toMatch(/^import \{ PulseTracker \}/);
  });
});

// ── injectInstrumentation ──────────────────────────────────────────

describe("injectInstrumentation", () => {
  it("creates full file when none exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await injectInstrumentation();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/fake/src/instrumentation.ts",
      expect.stringContaining("createPulseErrorReporter"),
      "utf8"
    );
  });

  it("places file at root when app dir is not under src/", async () => {
    mockedGetAppDir.mockReturnValue("/fake/app");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await injectInstrumentation();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/fake/instrumentation.ts",
      expect.anything(),
      "utf8"
    );
  });

  it("skips when onRequestError is already present", async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === "/fake/src/instrumentation.ts"
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      'export const onRequestError = () => {};' as any
    );

    await injectInstrumentation();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("onRequestError already present")
    );
  });

  it("appends import and export block to existing file with imports", async () => {
    const existing = [
      'import { something } from "somewhere";',
      "",
      "export function register() {}",
    ].join("\n");

    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === "/fake/src/instrumentation.ts"
    );
    vi.mocked(fs.readFileSync).mockReturnValue(existing as any);

    await injectInstrumentation();

    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;

    // Import inserted after existing imports
    expect(written).toContain(
      'import { something } from "somewhere";\nimport { createPulseErrorReporter } from "@pulsekit/next";'
    );

    // Export block appended at end
    expect(written).toContain("export const onRequestError = createPulseErrorReporter(");
  });

  it("prepends import when file has no existing imports", async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === "/fake/src/instrumentation.ts"
    );
    vi.mocked(fs.readFileSync).mockReturnValue("export function register() {}" as any);

    await injectInstrumentation();

    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toMatch(/^import \{ createPulseErrorReporter \}/);
    expect(written).toContain("export const onRequestError");
  });
});
