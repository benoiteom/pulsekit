const encoder = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Timing-safe string comparison using HMAC-then-verify.
 * Returns true if `a === b` without leaking timing info.
 */
export async function timingSafeEqual(
  a: string,
  b: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("pulse-timing-safe"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(a));
  return crypto.subtle.verify("HMAC", key, sig, encoder.encode(b));
}

/**
 * Create an HMAC-SHA256 signed token with an embedded expiry.
 * Format: `{expiry_hex}.{hmac_hex}`
 */
export async function createPulseToken(
  secret: string,
  ttlMs: number,
): Promise<string> {
  const expiry = (Date.now() + ttlMs).toString(16);
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(expiry));
  return `${expiry}.${toHex(sig)}`;
}

/**
 * Verify an HMAC-SHA256 signed token: checks signature and expiry.
 * Uses `crypto.subtle.verify` for timing-safe comparison.
 */
export async function verifyPulseToken(
  secret: string,
  token: string,
): Promise<boolean> {
  try {
    const dotIndex = token.indexOf(".");
    if (dotIndex === -1) return false;

    const expiry = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    // Check expiry
    const expiryMs = parseInt(expiry, 16);
    if (isNaN(expiryMs) || expiryMs < Date.now()) return false;

    // Verify HMAC (timing-safe via crypto.subtle.verify)
    const key = await getKey(secret);
    const sigBytes = fromHex(sig);
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(expiry),
    );
  } catch {
    return false;
  }
}
