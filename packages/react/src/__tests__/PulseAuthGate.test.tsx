import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// ── Mocks ────────────────────────────────────────────────────────────

const mockCookieStore = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({
    get: (name: string) => mockCookieStore.get(name),
  }),
}));

const mockVerifyPulseToken = vi.fn();

vi.mock("@pulsekit/core", () => ({
  verifyPulseToken: (...args: unknown[]) => mockVerifyPulseToken(...args),
}));

// Keep real PulseLoginForm — we'll check by component type
import { PulseAuthGate } from "../PulseAuthGate";
import { PulseLoginForm } from "../PulseLoginForm";

// ── Helpers ──────────────────────────────────────────────────────────

const SECRET = "test-auth-gate-secret";

beforeEach(() => {
  mockCookieStore.clear();
  mockVerifyPulseToken.mockReset();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("PulseAuthGate", () => {
  it("throws when secret prop is empty", async () => {
    await expect(
      PulseAuthGate({ children: React.createElement("div"), secret: "" }),
    ).rejects.toThrow("secret");
  });

  it("renders children when cookie has valid token", async () => {
    mockCookieStore.set("pulse_auth", { value: "valid.token" });
    mockVerifyPulseToken.mockResolvedValue(true);

    const result = await PulseAuthGate({
      children: React.createElement("span", null, "Dashboard"),
      secret: SECRET,
    });

    expect(result).toBeDefined();
    expect(mockVerifyPulseToken).toHaveBeenCalledWith(SECRET, "valid.token");
    // Should render a Fragment wrapping children
    const rendered = result as React.ReactElement;
    expect(rendered.type).toBe(React.Fragment);
  });

  it("renders login form when no cookie is present", async () => {
    const result = await PulseAuthGate({
      children: React.createElement("span", null, "Dashboard"),
      secret: SECRET,
    });

    // Result is a JSX element whose type is PulseLoginForm
    const rendered = result as React.ReactElement;
    expect(rendered.type).toBe(PulseLoginForm);
    expect(mockVerifyPulseToken).not.toHaveBeenCalled();
  });

  it("renders login form when token verification fails", async () => {
    mockCookieStore.set("pulse_auth", { value: "expired.token" });
    mockVerifyPulseToken.mockResolvedValue(false);

    const result = await PulseAuthGate({
      children: React.createElement("span", null, "Dashboard"),
      secret: SECRET,
    });

    const rendered = result as React.ReactElement;
    expect(rendered.type).toBe(PulseLoginForm);
  });

  it("passes authEndpoint to login form", async () => {
    const result = await PulseAuthGate({
      children: React.createElement("span", null, "Dashboard"),
      secret: SECRET,
      authEndpoint: "/custom/auth",
    });

    const rendered = result as React.ReactElement;
    expect(rendered.type).toBe(PulseLoginForm);
    expect(rendered.props.authEndpoint).toBe("/custom/auth");
  });
});
