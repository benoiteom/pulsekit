import { describe, it, expect, vi } from "vitest";
import { createPulseToken, verifyPulseToken } from "../auth";

const SECRET = "test-secret-key";

describe("createPulseToken", () => {
  it("returns a string in {expiry_hex}.{hmac_hex} format", async () => {
    const token = await createPulseToken(SECRET, 60_000);
    expect(token).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
  });

  it("embeds an expiry in the future", async () => {
    const before = Date.now();
    const token = await createPulseToken(SECRET, 60_000);
    const expiry = parseInt(token.split(".")[0], 16);
    expect(expiry).toBeGreaterThanOrEqual(before + 60_000);
  });
});

describe("verifyPulseToken", () => {
  it("returns true for a valid token", async () => {
    const token = await createPulseToken(SECRET, 60_000);
    expect(await verifyPulseToken(SECRET, token)).toBe(true);
  });

  it("returns false for an expired token", async () => {
    vi.useFakeTimers();
    const token = await createPulseToken(SECRET, 1_000);
    vi.advanceTimersByTime(2_000);
    expect(await verifyPulseToken(SECRET, token)).toBe(false);
    vi.useRealTimers();
  });

  it("returns false for a tampered HMAC", async () => {
    const token = await createPulseToken(SECRET, 60_000);
    const [expiry] = token.split(".");
    const tampered = `${expiry}.${"00".repeat(32)}`;
    expect(await verifyPulseToken(SECRET, tampered)).toBe(false);
  });

  it("returns false for a tampered expiry", async () => {
    const token = await createPulseToken(SECRET, 60_000);
    const [, hmac] = token.split(".");
    const fakeExpiry = (Date.now() + 999_999_999).toString(16);
    expect(await verifyPulseToken(SECRET, `${fakeExpiry}.${hmac}`)).toBe(false);
  });

  it("returns false for a wrong secret", async () => {
    const token = await createPulseToken(SECRET, 60_000);
    expect(await verifyPulseToken("wrong-secret", token)).toBe(false);
  });

  it("returns false for empty string", async () => {
    expect(await verifyPulseToken(SECRET, "")).toBe(false);
  });

  it("returns false for malformed token (no dot)", async () => {
    expect(await verifyPulseToken(SECRET, "abc123")).toBe(false);
  });

  it("returns false for malformed token (non-hex)", async () => {
    expect(await verifyPulseToken(SECRET, "xyz.abc")).toBe(false);
  });
});
