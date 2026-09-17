"use client";

import { useState } from "react";
import { BellRing, Check, Mail, MessageCircle } from "lucide-react";
import { WHATSAPP_CHANNEL_URL } from "@/lib/links";

interface Props {
  source?: string;
  /** Single-column layout for narrow placements (sidebars). */
  stacked?: boolean;
}

/**
 * Promo alerts: WhatsApp channel follow + email recap signup.
 * Self-contained; drop it anywhere (offer modal, homepage, articles).
 */
export default function AlertSubscribe({ source = "offer-modal", stacked = false }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Inscription impossible.");
      }
      setState("done");
      setMessage("Merci ! Vous recevrez nos meilleures offres.");
      setEmail("");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Inscription impossible.");
    }
  }

  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
        <BellRing className="h-4 w-4 text-green-600" />
        Alertes promos comme celle-ci
      </p>

      <div className={`mt-3 grid gap-3 ${stacked ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        <div className="rounded-xl bg-white border border-green-100 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
            Chaîne WhatsApp
          </p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Suivez la chaîne pour ne rien manquer des prochaines offres.
          </p>
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center justify-center gap-1.5 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Suivre sur WhatsApp
          </a>
        </div>

        <div className="rounded-xl bg-white border border-green-100 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
            <Mail className="h-3.5 w-3.5 text-green-600" />
            Récap par e-mail
          </p>
          {state === "done" ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2">
              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {message}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-2">
              <div className="flex gap-1.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Votre e-mail"
                  aria-label="Votre adresse e-mail"
                  disabled={state === "loading"}
                  className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={state === "loading"}
                  className="shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-bold px-3.5 py-2 rounded-lg transition-colors"
                >
                  {state === "loading" ? "…" : "OK"}
                </button>
              </div>
              {state === "error" && (
                <p className="mt-1.5 text-xs text-red-600">{message}</p>
              )}
              <p className="mt-1.5 text-[11px] leading-snug text-gray-400">
                Un résumé hebdomadaire. Désinscription en un clic.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
