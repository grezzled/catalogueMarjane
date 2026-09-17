"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, ThumbsUp, Send, BadgeCheck } from "lucide-react";
import type { PublishedReview, ReviewSummary } from "@/services/reviews";
import { REVIEW_MAX_CONTENT, REVIEW_MAX_TITLE, REVIEW_MIN_CONTENT } from "@/services/reviews";

const PSEUDO_KEY = "mc-pseudo";
const VOTED_KEY = "mc-voted-reviews";

type SortKey = "recent" | "helpful" | "highest" | "lowest";

/** Star display with fractional fill (e.g. 4.3). */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (filled: boolean) => (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`${className} ${filled ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`}
        />
      ))}
    </span>
  );
  return (
    <span className="relative inline-flex" role="img" aria-label={`${value.toFixed(1)} sur 5 étoiles`}>
      {row(false)}
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row(true)}
      </span>
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="inline-flex gap-1" role="radiogroup" aria-label="Votre note">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={`${v} étoile${v > 1 ? "s" : ""}`}
          onClick={() => onChange(v)}
          onMouseEnter={() => setHover(v)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star className={`h-7 w-7 ${v <= shown ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />
        </button>
      ))}
      <span className="ml-2 text-sm font-medium text-gray-500 self-center">
        {shown === 0 ? "Choisissez une note" : ["", "Mauvais", "Moyen", "Bien", "Très bien", "Excellent"][shown]}
      </span>
    </span>
  );
}

function loadVoted(): string[] {
  try {
    const raw = localStorage.getItem(VOTED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // ignore
  }
  return [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReviewsSection({ productId, productName }: { productId: string; productName: string }) {
  const [reviews, setReviews] = useState<PublishedReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [visible, setVisible] = useState(5);
  const [voted, setVoted] = useState<string[]>(() => loadVoted());
  const [pendingNotice, setPendingNotice] = useState(false);

  // Form state (pseudo lazy-loaded once — no effect needed)
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(PSEUDO_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [recommend, setRecommend] = useState<"yes" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { reviews: PublishedReview[]; summary: ReviewSummary };
        if (!cancelled) {
          setReviews(data.reviews ?? []);
          setSummary(data.summary ?? null);
        }
      } catch {
        if (!cancelled) setLoadError("Impossible de charger les avis.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const filtered = useMemo(() => {
    const arr = starFilter == null ? [...reviews] : reviews.filter((r) => r.rating === starFilter);
    switch (sort) {
      case "helpful":
        arr.sort((a, b) => b.helpful - a.helpful || +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case "highest":
        arr.sort((a, b) => b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case "lowest":
        arr.sort((a, b) => a.rating - b.rating || +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      default:
        arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
    return arr;
  }, [reviews, sort, starFilter]);

  async function vote(id: string) {
    if (voted.includes(id)) return;
    setVoted((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem(VOTED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, helpful: r.helpful + 1 } : r)));
    try {
      const res = await fetch(`/api/reviews/${id}/helpful`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { helpful: number };
        setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, helpful: data.helpful } : r)));
      }
    } catch {
      // keep optimistic count
    }
  }

  async function submit() {
    setFormError(null);
    if (rating < 1) {
      setFormError("Choisissez une note de 1 à 5 étoiles.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, author: author.trim(), rating, title: title.trim(), content: content.trim(), recommend }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFormError(data?.error ?? "Publication impossible.");
        return;
      }
      setContent("");
      setTitle("");
      setRating(0);
      setRecommend(null);
      setPendingNotice(true);
      try {
        localStorage.setItem(PSEUDO_KEY, author.trim());
      } catch {
        // ignore
      }
    } catch {
      setFormError("Publication impossible pour le moment.");
    } finally {
      setSubmitting(false);
    }
  }

  const formValid =
    author.trim().length >= 2 && rating >= 1 && content.trim().length >= REVIEW_MIN_CONTENT;

  return (
    <section id="avis" className="mb-14 scroll-mt-24" aria-label="Avis clients">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-amber-500 to-orange-400 rounded-xl p-2.5 shadow-lg shadow-amber-200">
          <Star className="h-6 w-6 text-white fill-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Avis clients</h2>
          <p className="text-sm text-gray-500">
            {loading ? "Chargement…" : summary && summary.count > 0 ? `${summary.count} avis vérifiés par la communauté` : "Soyez le premier à noter ce produit"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 animate-pulse">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="mt-3 h-3 rounded bg-gray-100 w-full" />
        </div>
      ) : loadError ? (
        <p className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-sm text-gray-500">{loadError}</p>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 mb-4">
            {summary && summary.count > 0 ? (
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="text-center sm:min-w-36">
                  <p className="text-5xl font-extrabold text-gray-900">{summary.average?.toFixed(1)}</p>
                  <div className="mt-1 flex justify-center"><Stars value={summary.average ?? 0} /></div>
                  <p className="mt-1 text-xs text-gray-500">{summary.count} avis</p>
                  {summary.recommendRate != null && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {Math.round(summary.recommendRate * 100)} % recommandent
                    </p>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const n = summary.distribution[s - 1];
                    const pct = summary.count > 0 ? (n / summary.count) * 100 : 0;
                    const active = starFilter === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStarFilter(active ? null : s)}
                        title={active ? "Retirer le filtre" : `Voir les avis ${s} étoiles`}
                        className={`w-full flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${active ? "bg-amber-50 ring-1 ring-amber-300" : "hover:bg-gray-50"}`}
                      >
                        <span className="text-xs font-medium text-gray-600 w-8 tabular-nums">{s} ★</span>
                        <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <span className="block h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{n}</span>
                      </button>
                    );
                  })}
                  {starFilter != null && (
                    <button type="button" onClick={() => setStarFilter(null)} className="text-xs text-blue-600 hover:underline">
                      Voir tous les avis
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Aucun avis pour <span className="font-medium text-gray-700">{productName}</span> — partagez votre expérience ci-dessous ! ⭐
              </p>
            )}
          </div>

          {/* Sort */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <label htmlFor="review-sort" className="text-xs text-gray-500">Trier :</label>
              <select
                id="review-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="recent">Plus récents</option>
                <option value="helpful">Plus utiles</option>
                <option value="highest">Meilleures notes</option>
                <option value="lowest">Moins bonnes notes</option>
              </select>
            </div>
          )}

          {/* List */}
          <div className="space-y-4 mb-4">
            {filtered.slice(0, visible).map((r) => (
              <article key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Stars value={r.rating} />
                  {r.title && <h3 className="font-bold text-gray-900 text-sm">{r.title}</h3>}
                </div>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{r.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{r.author}</span>
                  <span>{formatDate(r.createdAt)}</span>
                  {r.recommend === true && <span className="text-green-700 font-medium">✓ Recommande</span>}
                  {r.recommend === false && <span className="text-gray-400">Ne recommande pas</span>}
                  <button
                    type="button"
                    onClick={() => vote(r.id)}
                    disabled={voted.includes(r.id)}
                    className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
                      voted.includes(r.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                        : "border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                    }`}
                    title={voted.includes(r.id) ? "Vous avez trouvé cet avis utile" : "Utile ?"}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Utile{r.helpful > 0 && <span className="tabular-nums">({r.helpful})</span>}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && reviews.length > 0 && (
            <p className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-500 mb-4">
              Aucun avis {starFilter} étoile{starFilter !== 1 ? "s" : ""} pour l&apos;instant.
            </p>
          )}
          {filtered.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + 10)}
              className="mb-4 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            >
              Voir plus d&apos;avis ({filtered.length - visible} restants)
            </button>
          )}

          {/* Form */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
            <h3 className="font-bold text-gray-900 mb-1">Donnez votre avis</h3>
            <p className="text-xs text-gray-500 mb-4">Avez-vous acheté ce produit ? Votre retour aide la communauté. Publication après validation.</p>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Votre pseudo"
                  maxLength={40}
                  aria-label="Votre pseudo"
                  className="flex-1 min-w-40 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
                <StarInput value={rating} onChange={setRating} />
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, REVIEW_MAX_TITLE))}
                placeholder={`Titre de votre avis (optionnel, ${REVIEW_MAX_TITLE} caractères max)`}
                aria-label="Titre de votre avis"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, REVIEW_MAX_CONTENT))}
                placeholder={`Racontez votre expérience : qualité, rapport qualité-prix, trouvé en magasin… (${REVIEW_MIN_CONTENT} caractères min)`}
                rows={4}
                aria-label="Votre avis"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors resize-y min-h-[96px]"
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-600">Le recommandez-vous ?</span>
                {(["yes", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRecommend(recommend === v ? null : v)}
                    aria-pressed={recommend === v}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      recommend === v
                        ? v === "yes"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-400 bg-gray-100 text-gray-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {v === "yes" ? "Oui 👍" : "Non 👎"}
                  </button>
                ))}
                <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{content.length}/{REVIEW_MAX_CONTENT}</span>
              </div>
            </div>
            {formError && <p className="mt-2 text-xs font-medium text-red-600">{formError}</p>}
            {pendingNotice && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                Merci ! Votre avis a bien été envoyé et sera visible après validation. ✅
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !formValid}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-default"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Publication…" : "Publier mon avis"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
