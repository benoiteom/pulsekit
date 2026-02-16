import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

import fs from "node:fs";
import { detectPackageManager, validateNextJsProject, getAppDir } from "../detect";

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReset();
  vi.mocked(fs.readFileSync).mockReset();
  vi.spyOn(process, "cwd").mockReturnValue("/fake");
});

// ── detectPackageManager ───────────────────────────────────────────

describe("detectPackageManager", () => {
  it("returns bun when bun.lock exists", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/bun.lock");
    expect(detectPackageManager()).toBe("bun");
  });

  it("returns bun when bun.lockb exists", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/bun.lockb");
    expect(detectPackageManager()).toBe("bun");
  });

  it("returns pnpm when pnpm-lock.yaml exists", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/pnpm-lock.yaml");
    expect(detectPackageManager()).toBe("pnpm");
  });

  it("returns yarn when yarn.lock exists", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/yarn.lock");
    expect(detectPackageManager()).toBe("yarn");
  });

  it("defaults to npm when no lock file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(detectPackageManager()).toBe("npm");
  });

  it("prioritizes bun over pnpm", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return s === "/fake/bun.lock" || s === "/fake/pnpm-lock.yaml";
    });
    expect(detectPackageManager()).toBe("bun");
  });
});

// ── getAppDir ──────────────────────────────────────────────────────

describe("getAppDir", () => {
  it("returns src/app when it exists", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/src/app");
    expect(getAppDir()).toBe("/fake/src/app");
  });

  it("returns app/ when src/app does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(getAppDir()).toBe("/fake/app");
  });
});

// ── validateNextJsProject ──────────────────────────────────────────

describe("validateNextJsProject", () => {
  it("throws when package.json is missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(() => validateNextJsProject()).toThrow("No package.json found");
  });

  it("throws when next is not a dependency", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/package.json");
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ dependencies: { react: "^19" } }) as any
    );
    expect(() => validateNextJsProject()).toThrow("next is not listed");
  });

  it("throws when app directory is missing", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === "/fake/package.json");
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ dependencies: { next: "^15" } }) as any
    );
    expect(() => validateNextJsProject()).toThrow("No app/ directory");
  });

  it("succeeds when all checks pass", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return s === "/fake/package.json" || s === "/fake/src/app";
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ dependencies: { next: "^15" } }) as any
    );
    expect(() => validateNextJsProject()).not.toThrow();
  });

  it("accepts next in devDependencies", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return s === "/fake/package.json" || s === "/fake/app";
    });
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ devDependencies: { next: "^15" } }) as any
    );
    expect(() => validateNextJsProject()).not.toThrow();
  });
});
