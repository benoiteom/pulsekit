import { createPulseToken } from "@pulsekit/core";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Generate a signed ingestion token for PulseTracker.
 * Call this server-side (e.g. in a layout) and pass the result as a prop.
 */
export function createPulseIngestionToken(
  secret: string,
  ttlMs: number = TWENTY_FOUR_HOURS,
): Promise<string> {
  return createPulseToken(secret, ttlMs);
}
