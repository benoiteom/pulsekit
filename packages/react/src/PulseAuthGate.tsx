import { cookies } from "next/headers";
import { verifyPulseToken } from "@pulsekit/core";
import { PulseLoginForm } from "./PulseLoginForm.js";

export interface PulseAuthGateProps {
  children: React.ReactNode;
  /** PULSE_SECRET value — required for authentication. */
  secret: string;
  /** Auth endpoint for the login form. Defaults to "/api/pulse/auth". */
  authEndpoint?: string;
}

export async function PulseAuthGate({
  children,
  secret,
  authEndpoint,
}: PulseAuthGateProps) {
  if (!secret) {
    throw new Error(
      "[pulsekit] The `secret` prop is required on PulseAuthGate. " +
      "Pass process.env.PULSE_SECRET to enable authentication.",
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("pulse_auth")?.value;

  if (token && (await verifyPulseToken(secret, token))) {
    return <>{children}</>;
  }

  return <PulseLoginForm authEndpoint={authEndpoint} />;
}
