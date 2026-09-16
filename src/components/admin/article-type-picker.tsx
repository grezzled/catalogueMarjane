"use client";

import { useEffect, useState } from "react";

interface CategoryOption {
  name: string;
  offerCount: number;
}

interface ArticleTypeOption {
  id: string;
  label: string;
  description: string;
  needsCategory: boolean;
  minOffers: number;
  offerCount: number;
  available: boolean;
  categories: CategoryOption[];
}

export interface QueuedArticleJob {
  jobId: string;
  queued: boolean;
  articleType: string;
  category: string | null;
}

interface Props {
  catalogueId: string;
  catalogueTitle: string;
  onClose: () => void;
  onQueued: (job: QueuedArticleJob) => void;
  /** Render as an embedded card instead of a modal overlay. */
  inline?: boolean;
}

/**
 * Intent picker for article generation: the admin chooses WHAT to write
 * (overview, category focus, top deals, budget, buying guide) with live
 * data counts — thin slices are disabled, never generated.
 */
export default function ArticleTypePicker({
  catalogueId,
  catalogueTitle,
  onClose,
  onQueued,
  inline = false,
}: Props) {
  const [options, setOptions] = useState<ArticleTypeOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [queueing, setQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/catalogues/${catalogueId}/article-types`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.options) {
          setOptions(data.options);
          const first = (data.options as ArticleTypeOption[]).find((o) => o.available);
          if (first) setSelectedType(first.id);
        } else {
          setLoadError(data?.error || "Impossible de charger les types d'article");
        }
      })
      .catch(() => setLoadError("Erreur réseau"));
  }, [catalogueId]);

  const selected = options?.find((o) => o.id === selectedType) ?? null;
  const needsCategoryChoice = !!selected?.needsCategory;
  const canQueue =
    !!selected?.available &&
    !queueing &&
    (!needsCategoryChoice || !!selectedCategory);

  async function handleQueue() {
    if (!selected || !canQueue) return;
    setQueueing(true);
    setQueueError(null);
    try {
      const res = await fetch(`/api/catalogues/${catalogueId}/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleType: selected.id,
          ...(needsCategoryChoice ? { category: selectedCategory } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.jobId) {
        onQueued({
          jobId: data.jobId,
          queued: data.queued !== false,
          articleType: data.articleType ?? selected.id,
          category: data.category ?? (needsCategoryChoice ? selectedCategory : null),
        });
      } else {
        setQueueError(data?.error || "Échec de mise en file d'attente");
      }
    } catch {
      setQueueError("Erreur réseau");
    } finally {
      setQueueing(false);
    }
  }

  // NOTE: callers remount via key={catalogueId} when switching catalogue —
  // no reset effect here (setState-in-effect is an error in this repo).

  const body = (
    <>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">
            Générer un article
          </h2>
          {!inline && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              title="Fermer"
            >
              ×
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4 truncate" title={catalogueTitle}>
          {catalogueTitle}
        </p>

        {loadError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {loadError}
          </p>
        )}

        {!options && !loadError && (
          <p className="text-sm text-gray-500 py-6 text-center">
            Chargement des types disponibles…
          </p>
        )}

        {options && (
          <div className="space-y-2">
            {options.map((opt) => {
              const active = selectedType === opt.id;
              return (
                <button
                  key={opt.id}
                  disabled={!opt.available}
                  onClick={() => {
                    setSelectedType(opt.id);
                    setSelectedCategory("");
                    setQueueError(null);
                  }}
                  className={`w-full text-left border rounded-xl px-4 py-3 transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : opt.available
                        ? "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                        : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-gray-900">
                      {opt.label}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        opt.available
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {opt.needsCategory
                        ? `${opt.categories.length} rayon(s)`
                        : `${opt.offerCount} offre(s)`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                  {!opt.available && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Pas assez de données (minimum {opt.minOffers} offres)
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selected && needsCategoryChoice && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Rayon (minimum {selected.minOffers} offres)
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choisir un rayon…</option>
              {selected.categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.offerCount} offres)
                </option>
              ))}
            </select>
          </div>
        )}

        {queueError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
            {queueError}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          {!inline && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Annuler
            </button>
          )}
          <button
            onClick={handleQueue}
            disabled={!canQueue}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {queueing ? "En file d'attente…" : "Mettre en file d'attente"}
          </button>
        </div>
    </>
  );

  if (inline) {
    return (
      <div className="bg-white rounded-xl shadow w-full p-6">
        {body}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {body}
      </div>
    </div>
  );
}
