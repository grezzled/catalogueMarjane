"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import {
  CONSENT_EVENT,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

export default function CookieConsent() {
  const [choice, setChoice] = useState<CookieConsentValue | null | undefined>(
    undefined
  );

  useEffect(() => {
    const sync = () => setChoice(readCookieConsent());
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(CONSENT_EVENT, sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CONSENT_EVENT, sync);
    };
  }, []);

  function choose(value: CookieConsentValue) {
    writeCookieConsent(value);
    setChoice(value);
  }

  if (choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="no-print fixed z-[60] inset-x-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-6 md:bottom-6 md:max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl shadow-gray-900/15"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-xl bg-amber-100 p-2">
          <Cookie className="h-5 w-5 text-amber-700" />
        </span>
        <div className="min-w-0">
          <h2
            id="cookie-consent-title"
            className="text-sm font-bold text-gray-900"
          >
            Nous utilisons des cookies
          </h2>
          <p
            id="cookie-consent-description"
            className="mt-1 text-sm leading-relaxed text-gray-600"
          >
            Nous utilisons des cookies pour mesurer l&apos;audience (Google
            Analytics) et, le cas échéant, afficher des publicités. Vous pouvez
            accepter ou refuser les cookies non essentiels.{" "}
            <Link
              href="/politique-confidentialite"
              className="font-medium text-blue-600 hover:text-blue-700 underline"
            >
              En savoir plus
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={() => choose("refused")}
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
