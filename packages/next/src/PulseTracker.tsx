"use client";

import { useEffect, useRef } from "react";

function getSessionId(): string {
  const key = "pulse_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export interface PulseTrackerProps {
  endpoint?: string;
  excludePaths?: string[];
  captureErrors?: boolean;
  errorLimit?: number;
}

export function PulseTracker({
  endpoint = "/api/pulse",
  excludePaths,
  captureErrors = true,
  errorLimit = 10,
}: PulseTrackerProps) {
  const vitalsRef = useRef<Record<string, number>>({});
  const hasSentVitalsRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const errorCountRef = useRef(0);
  const sentFingerprintsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    // Detect browser timezone and store in cookie for server-side reading
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `pulse_tz=${encodeURIComponent(tz)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    if (excludePaths?.includes(window.location.pathname)) return;

    const sessionId = getSessionId();
    sessionIdRef.current = sessionId;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pageview",
        path: window.location.pathname,
        sessionId,
      }),
    }).catch(() => {});
  }, [endpoint, excludePaths]);

  useEffect(() => {
    if (excludePaths?.includes(window.location.pathname)) return;

    // Dynamically import web-vitals to keep it out of the server bundle
    import("web-vitals")
      .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
        onLCP((m) => { vitalsRef.current.lcp = m.value; });
        onINP((m) => { vitalsRef.current.inp = m.value; }, { reportAllChanges: true });
        onCLS((m) => { vitalsRef.current.cls = m.value; }, { reportAllChanges: true });
        onFCP((m) => { vitalsRef.current.fcp = m.value; });
        onTTFB((m) => { vitalsRef.current.ttfb = m.value; });
      })
      .catch(() => {
        // web-vitals failed to load — silently degrade
      });

    function sendVitals() {
      if (hasSentVitalsRef.current) return;
      const metrics = vitalsRef.current;
      if (Object.keys(metrics).length === 0) return;

      hasSentVitalsRef.current = true;
      const body = JSON.stringify({
        type: "vitals",
        path: window.location.pathname,
        sessionId: sessionIdRef.current,
        meta: { ...metrics },
      });

      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          endpoint,
          new Blob([body], { type: "application/json" })
        );
      } else {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sendVitals();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", sendVitals);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", sendVitals);
    };
  }, [endpoint, excludePaths]);

  // ── Error capture ──────────────────────────────────────────────────
  useEffect(() => {
    if (!captureErrors) return;

    function sendError(meta: Record<string, unknown>) {
      if (errorCountRef.current >= errorLimit) return;

      const fingerprint = `${meta.message}|${meta.source ?? ""}|${meta.lineno ?? ""}`;
      if (sentFingerprintsRef.current.has(fingerprint)) return;
      sentFingerprintsRef.current.add(fingerprint);
      errorCountRef.current++;

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "error",
          path: window.location.pathname,
          sessionId: sessionIdRef.current,
          meta,
        }),
      }).catch(() => {});
    }

    function truncateStack(stack: string | undefined): string | null {
      if (!stack) return null;
      return stack.split("\n").slice(0, 10).join("\n").slice(0, 2048);
    }

    function onError(event: ErrorEvent) {
      sendError({
        message: String(event.message).slice(0, 1024),
        source: event.filename ?? null,
        lineno: event.lineno ?? null,
        colno: event.colno ?? null,
        stack: truncateStack(event.error?.stack),
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error
        ? reason.message
        : String(reason ?? "Unhandled promise rejection");

      sendError({
        message: message.slice(0, 1024),
        source: null,
        lineno: null,
        colno: null,
        stack: truncateStack(reason instanceof Error ? reason.stack : undefined),
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [captureErrors, errorLimit, endpoint]);

  return null;
}
