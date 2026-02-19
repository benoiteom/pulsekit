import type { Metadata } from "next";
import { PulseTracker } from "@pulsekit/next/client";
import { createPulseIngestionToken } from "@pulsekit/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseKit Analytics Demo",
  description: "Demo app for @pulse/analytics",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = process.env.PULSE_SECRET
    ? await createPulseIngestionToken(process.env.PULSE_SECRET)
    : undefined;

  return (
    <html lang="en">
      <body>
        {children}
        <PulseTracker excludePaths={["/admin/analytics"]} token={token} />
      </body>
    </html>
  );
}
