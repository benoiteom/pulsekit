import { createPulseAuthHandler } from "@pulsekit/next";

const handler = createPulseAuthHandler({ secret: process.env.PULSE_SECRET! });

export const POST = handler;
export const DELETE = handler;
