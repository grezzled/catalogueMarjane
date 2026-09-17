"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Eye, MessageCircle, Trash2, X } from "lucide-react";

type Status = "PENDING" | "PUBLISHED" | "REJECTED" | "ALL";

interface AdminComment {
  id: string;
  targetType: string;
  author: string;
  content: string;
  status: string;
  createdAt: string;
  parentId: string | null;
  parent: { author: string } | null;
  catalogue: { id: string; title: string; slug: string } | null;
  article: { id: string; title: string; slug: string } | null;
  product: { id: string; name: string; slug: string | null } | null;
  votes: number;
  replyCount: number;
}

const TABS: { key: Status; label: string }[] = [
  { key: "PENDING", label: "En attente" },
  { key: "PUBLISHED", label: "Publiés" },
  { key: "REJECTED", label: "Rejetés" },
  { key: "ALL", label: "Tous" },
];

export default function AdminCommentsPage() {
  const [tab, setTab] = useState<Status>("PENDING");
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [counts, setCounts] = useState({ PENDING: 0, PUBLISHED: 0, REJECTED: 0 });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (status: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/comments?status=${status}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setComments(data.comments ?? []);
      setCounts(data.counts ?? { PENDING: 0, PUBLISHED: 0, REJECTED: 0 });
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function act(id: string, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !confirm("Supprimer définitivement ce commentaire et ses réponses ?")) return;
    setActing(id);
    try {
      const res = await fetch(
        `/api/admin/comments/${id}`,
        action === "delete"
          ? { method: "DELETE" }
          : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }
      );
      if (!res.ok) throw new Error();
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCounts((prev) => {
        const next = { ...prev };
        const key = comments.find((c) => c.id === id)?.status;
        if (key === "PENDING" || key === "PUBLISHED" || key === "REJECTED") {
          next[key] = Math.max(0, next[key] - 1);
        }
        if (action === "approve") next.PUBLISHED += 1;
        if (action === "reject") next.REJECTED += 1;
        return next;
      });
    } catch {
      alert("Action impossible pour le moment.");
    } finally {
      setActing(null);
    }
  }

  function targetLink(c: AdminComment) {
    if (c.targetType === "catalogue" && c.catalogue) {
      return { href: `/catalogue-marjane/${c.catalogue.slug}`, label: c.catalogue.title };
    }
    if (c.targetType === "article" && c.article) {
      return { href: `/articles/${c.article.slug}`, label: c.article.title };
    }
    if (c.targetType === "product" && c.product) {
      return { href: `/produit/${c.product.slug ?? c.product.id}`, label: c.product.name };
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-rose-100 rounded-lg p-2">
            <MessageCircle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modération des commentaires</h1>
            <p className="text-sm text-gray-500">Validez les avis avant leur publication sur le site.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => {
            const count = t.key === "ALL" ? undefined : counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {t.label}
                {count !== undefined && (
                  <span
                    className={`text-xs rounded-full px-1.5 py-0.5 tabular-nums ${
                      tab === t.key ? "bg-white/20" : "bg-gray-100"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : comments.length === 0 ? (
          <p className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center text-sm text-gray-500">
            Rien à modérer ici. 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => {
              const link = targetLink(c);
              const busy = acting === c.id;
              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-gray-900 text-sm">{c.author}</span>
                    <span className="text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        c.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : c.status === "PUBLISHED"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.status === "PENDING" ? "En attente" : c.status === "PUBLISHED" ? "Publié" : "Rejeté"}
                    </span>
                    {link && (
                      <Link
                        href={link.href}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium truncate max-w-full"
                      >
                        <Eye className="h-3 w-3 shrink-0" />
                        <span className="truncate">{link.label}</span>
                      </Link>
                    )}
                    {c.parent && <span className="text-gray-400">↩ en réponse à {c.parent.author}</span>}
                    {(c.votes > 0 || c.replyCount > 0) && (
                      <span className="text-gray-400 tabular-nums">
                        {c.votes > 0 && `❤ ${c.votes}`}
                        {c.votes > 0 && c.replyCount > 0 && " · "}
                        {c.replyCount > 0 && `↩ ${c.replyCount}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.status !== "PUBLISHED" && (
                      <button
                        onClick={() => act(c.id, "approve")}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approuver
                      </button>
                    )}
                    {c.status !== "REJECTED" && (
                      <button
                        onClick={() => act(c.id, "reject")}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:border-amber-400 hover:text-amber-700 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Rejeter
                      </button>
                    )}
                    <button
                      onClick={() => act(c.id, "delete")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-4 py-2 text-xs font-bold text-red-600 hover:border-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
