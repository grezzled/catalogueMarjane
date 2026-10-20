"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Mail, MailOpen, Trash2 } from "lucide-react";

interface ContactMessage {
  id: string;
  name: string | null;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/messages");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function setStatus(id: string, status: "NEW" | "READ") {
    setActing(id);
    try {
      const res = await fetch("/api/admin/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
    } catch {
      alert("Mise à jour impossible.");
    } finally {
      setActing(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement ce message ?")) return;
    setActing(id);
    try {
      const res = await fetch(`/api/admin/messages?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Suppression impossible.");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="h-5 w-5 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">
          Messages de contact
        </h1>
      </div>

      {loading ? (
        <p className="text-gray-500">Chargement…</p>
      ) : messages.length === 0 ? (
        <p className="text-gray-500">Aucun message pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const unread = m.status === "NEW";
            return (
              <li
                key={m.id}
                className={`rounded-2xl border p-5 ${
                  unread
                    ? "border-blue-200 bg-blue-50/50"
                    : "border-gray-100 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {m.subject}
                      {unread && (
                        <span className="ml-2 text-[11px] font-bold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5 align-middle">
                          Nouveau
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {m.name ? `${m.name} — ` : ""}
                      <a href={`mailto:${m.email}`} className="text-blue-600">
                        {m.email}
                      </a>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(m.createdAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStatus(m.id, unread ? "READ" : "NEW")}
                      disabled={acting === m.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {unread ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Marquer comme lu
                        </>
                      ) : (
                        <>
                          <MailOpen className="h-3.5 w-3.5" /> Marquer comme non
                          lu
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      disabled={acting === m.id}
                      aria-label="Supprimer"
                      className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                  {m.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
