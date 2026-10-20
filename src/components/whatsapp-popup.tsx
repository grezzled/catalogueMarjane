"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { CONSENT_EVENT, readCookieConsent } from "@/lib/cookie-consent";
import { WHATSAPP_CHANNEL_URL } from "@/lib/links";

const STORAGE_KEY = "cm_whatsapp_popup_dismissed_at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SHOW_DELAY_MS = 3500;

export default function WhatsAppPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // storage unavailable (private mode) — the popup simply reappears later
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
    } catch {
      dismissedAt = 0;
    }
    if (Date.now() - dismissedAt < SNOOZE_MS) return;

    let showTimer: number | undefined;
    const schedule = () => {
      showTimer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    };
    const onConsent = () => schedule();

    // Never stack on top of the cookie banner: wait for the consent choice.
    if (readCookieConsent() !== null) schedule();
    else window.addEventListener(CONSENT_EVENT, onConsent);

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      window.removeEventListener(CONSENT_EVENT, onConsent);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-popup-title"
      aria-describedby="whatsapp-popup-description"
      className="no-print fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30">
          <MessageCircle className="h-7 w-7" />
        </div>

        <h2
          id="whatsapp-popup-title"
          className="mt-4 text-center text-xl font-extrabold tracking-tight text-gray-900"
        >
          Suivez notre chaîne WhatsApp
        </h2>
        <p
          id="whatsapp-popup-description"
          className="mt-2 text-center text-sm leading-relaxed text-gray-600"
        >
          Recevez chaque semaine les meilleures promotions Marjane et ne ratez
          plus aucune bonne affaire.
        </p>

        <a
          href={WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-green-600"
        >
          <MessageCircle className="h-4 w-4" />
          Suivre la chaîne
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
