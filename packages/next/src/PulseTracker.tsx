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
  /** Signed ingestion token for authenticated event collection. */
  token?: string;
  /** Called when a tracking request fails (e.g., network error, CORS failure). */
  onError?: (error: unknown) => void;
}

export function PulseTracker({
  endpoint = "/api/pulse",
  excludePaths,
  captureErrors = true,
  errorLimit = 10,
  token,
  onError,
}: PulseTrackerProps) {
  const vitalsRef = useRef<Record<string, number>>({});
  const hasSentVitalsRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const errorCountRef = useRef(0);
  const sentFingerprintsRef = useRef<Set<string>>(new Set());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    // Detect browser timezone and store in cookie for server-side reading
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `pulse_tz=${encodeURIComponent(tz)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;

    if (excludePaths?.includes(window.location.pathname)) return;

    const sessionId = getSessionId();
    sessionIdRef.current = sessionId;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["x-pulse-token"] = token;

    // Extract hostname from document.referrer for privacy (no full URLs stored)
    const ref = document.referrer;
    let referrer: string | null = null;
    try { referrer = ref ? new URL(ref).hostname : null; } catch { /* invalid URL */ }

    fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "pageview",
        path: window.location.pathname,
        sessionId,
        referrer,
      }),
    }).catch((e) => { onErrorRef.current?.(e); });
  }, [endpoint, excludePaths, token]);

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

      if (!token && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          endpoint,
          new Blob([body], { type: "application/json" })
        );
      } else {
        const hdrs: Record<string, string> = { "Content-Type": "application/json" };
        if (token) hdrs["x-pulse-token"] = token;
        fetch(endpoint, {
          method: "POST",
          headers: hdrs,
          body,
          keepalive: true,
        }).catch((e) => { onErrorRef.current?.(e); });
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
  }, [endpoint, excludePaths, token]);

  // ── Error capture ──────────────────────────────────────────────────
  useEffect(() => {
    if (!captureErrors) return;

    function sendError(meta: Record<string, unknown>) {
      if (errorCountRef.current >= errorLimit) return;

      const fingerprint = `${meta.message}|${meta.source ?? ""}|${meta.lineno ?? ""}`;
      if (sentFingerprintsRef.current.has(fingerprint)) return;
      sentFingerprintsRef.current.add(fingerprint);
      errorCountRef.current++;

      const hdrs: Record<string, string> = { "Content-Type": "application/json" };
      if (token) hdrs["x-pulse-token"] = token;

      fetch(endpoint, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          type: "error",
          path: window.location.pathname,
          sessionId: sessionIdRef.current,
          meta,
        }),
      }).catch((e) => { onErrorRef.current?.(e); });
    }

    function truncateStack(stack: string | undefined): string | null {
      if (!stack) return null;
      return stack.split("\n").slice(0, 10).join("\n").slice(0, 2048);
    }

    function onWindowError(event: ErrorEvent) {
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

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [captureErrors, errorLimit, endpoint, token]);

  return null;
}
