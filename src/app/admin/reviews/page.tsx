"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Eye, MessageCircle, Star, Trash2, X } from "lucide-react";

type Status = "PENDING" | "PUBLISHED" | "REJECTED" | "ALL";

interface AdminReview {
  id: string;
  author: string;
  rating: number;
  title: string | null;
  content: string;
  recommend: boolean | null;
  status: string;
  createdAt: string;
  helpful: number;
  product: { id: string; name: string; slug: string | null };
}

const TABS: { key: Status; label: string }[] = [
  { key: "PENDING", label: "En attente" },
  { key: "PUBLISHED", label: "Publiés" },
  { key: "REJECTED", label: "Rejetés" },
  { key: "ALL", label: "Tous" },
];

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<Status>("PENDING");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [counts, setCounts] = useState({ PENDING: 0, PUBLISHED: 0, REJECTED: 0 });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (status: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?status=${status}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setCounts(data.counts ?? { PENDING: 0, PUBLISHED: 0, REJECTED: 0 });
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function act(id: string, action: "approve" | "reject" | "delete") {
    if (action === "delete" && !confirm("Supprimer définitivement cet avis ?")) return;
    setActing(id);
    try {
      const res = await fetch(
        `/api/admin/reviews/${id}`,
        action === "delete"
          ? { method: "DELETE" }
          : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }
      );
      if (!res.ok) throw new Error();
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setCounts((prev) => {
        const next = { ...prev };
        const key = reviews.find((r) => r.id === id)?.status;
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-100 rounded-lg p-2">
            <Star className="h-5 w-5 text-amber-600 fill-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modération des avis produits</h1>
            <p className="text-sm text-gray-500">Validez les notes avant leur publication sur les pages produits.</p>
          </div>
          <Link href="/admin/comments" className="ml-auto text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            <MessageCircle className="h-4 w-4" /> Commentaires
          </Link>
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
        ) : reviews.length === 0 ? (
          <p className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center text-sm text-gray-500">
            Rien à modérer ici. 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const busy = acting === r.id;
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-gray-900 text-sm">{r.author}</span>
                    <span className="inline-flex items-center gap-0.5 font-bold text-amber-500 tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {r.rating}/5
                    </span>
                    <span className="text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        r.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : r.status === "PUBLISHED"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status === "PENDING" ? "En attente" : r.status === "PUBLISHED" ? "Publié" : "Rejeté"}
                    </span>
                    <Link
                      href={`/produit/${r.product.slug ?? r.product.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium truncate max-w-full"
                    >
                      <Eye className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.product.name}</span>
                    </Link>
                    {r.recommend === true && <span className="text-green-700 font-medium">✓ Recommande</span>}
                    {r.recommend === false && <span className="text-gray-400">Ne recommande pas</span>}
                    {r.helpful > 0 && <span className="text-gray-400 tabular-nums">👍 {r.helpful}</span>}
                  </div>
                  {r.title && <p className="mt-2 font-bold text-sm text-gray-900">{r.title}</p>}
                  <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {r.content}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== "PUBLISHED" && (
                      <button
                        onClick={() => act(r.id, "approve")}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approuver
                      </button>
                    )}
                    {r.status !== "REJECTED" && (
                      <button
                        onClick={() => act(r.id, "reject")}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:border-amber-400 hover:text-amber-700 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Rejeter
                      </button>
                    )}
                    <button
                      onClick={() => act(r.id, "delete")}
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
