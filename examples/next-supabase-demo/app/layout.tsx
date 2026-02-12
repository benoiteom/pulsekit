import type { Metadata } from "next";
import { PulseTracker } from "@pulsekit/next/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse Analytics Demo",
  description: "Demo app for @pulse/analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PulseTracker excludePaths={["/admin/analytics"]} />
      </body>
    </html>
  );
}
