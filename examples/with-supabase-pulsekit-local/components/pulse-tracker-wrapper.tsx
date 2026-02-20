import { PulseTracker } from "@pulsekit/next/client";
import { createPulseIngestionToken } from "@pulsekit/next";
import { connection } from "next/server";

export default async function PulseTrackerWrapper() {
  await connection();
  const token = process.env.PULSE_SECRET
    ? await createPulseIngestionToken(process.env.PULSE_SECRET)
    : undefined;

  return (
    <PulseTracker
      excludePaths={["/admin/analytics"]}
      token={token}
    />
  );
}
