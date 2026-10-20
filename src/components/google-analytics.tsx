"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { CONSENT_EVENT, readCookieConsent } from "@/lib/cookie-consent";

const GA_ID = "G-P9QXX1D00E";

export default function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(readCookieConsent() === "accepted");
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(CONSENT_EVENT, sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CONSENT_EVENT, sync);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
