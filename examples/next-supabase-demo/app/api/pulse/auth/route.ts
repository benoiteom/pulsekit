import { createPulseAuthHandler } from "@pulsekit/next";

if (!process.env.PULSE_SECRET) {
  throw new Error("[pulsekit] PULSE_SECRET environment variable is required.");
}

const handler = createPulseAuthHandler({ secret: process.env.PULSE_SECRET });

export const POST = handler;
export const DELETE = handler;
