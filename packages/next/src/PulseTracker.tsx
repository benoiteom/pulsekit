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
}

export function PulseTracker({ endpoint = "/api/pulse", excludePaths }: PulseTrackerProps) {
  const vitalsRef = useRef<Record<string, number>>({});
  const hasSentVitalsRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

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

  return null;
}
