"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * First-party pageview beacon (pathname only, no PII).
 * - Client-side only → bots without JS never hit it.
 * - Respects Do-Not-Track, skips /admin and /api.
 * - 500ms settle delay: counts settled views, not instant back-navigations.
 */
export default function PageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return;
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    const t = setTimeout(() => {
      fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
