import { cookies } from "next/headers";

/**
 * Server-side helper that reads the browser timezone from the cookie
 * set by <PulseTimezone />. Falls back to "UTC" if not set.
 */
export async function getPulseTimezone(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get("pulse_tz")?.value ?? "UTC";
}
