import { webcrypto } from "node:crypto";
import { defineConfig } from "vitest/config";

// Node 18 doesn't expose crypto globally — polyfill it for tests
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as Crypto;
}

export default defineConfig({
  test: {
    include: ["packages/*/src/__tests__/**/*.test.{ts,tsx}"],
  },
});
