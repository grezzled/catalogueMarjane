"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ArticleTypePicker, {
  type QueuedArticleJob,
} from "@/components/admin/article-type-picker";

interface CatalogueOption {
  id: string;
  title: string;
  status: string;
  offerCount: number;
  startDate: string;
  endDate: string;
}

interface JobState {
  jobId: string;
  articleType: string;
  category: string | null;
  status: string;
  lastLog: string | null;
  error: string | null;
  articleId: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function NewArticlePageInner() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("catalogueId");

  const [catalogues, setCatalogues] = useState<CatalogueOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogueId, setCatalogueId] = useState<string>(preselected ?? "");
  const [job, setJob] = useState<JobState | null>(null);

  useEffect(() => {
    fetch("/api/catalogues")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCatalogues(data);
          // Drop a ?catalogueId= that isn't in the list.
          if (preselected && !data.some((c: CatalogueOption) => c.id === preselected)) {
            setCatalogueId("");
          }
        } else {
          setLoadError("Impossible de charger les catalogues");
        }
      })
      .catch(() => setLoadError("Erreur réseau"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = catalogues?.find((c) => c.id === catalogueId) ?? null;

  async function pollJob(jobId: string) {
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) continue;
        const data = await res.json();
        const logs = data.result?.logs;
        const last = Array.isArray(logs) && logs.length > 0 ? logs[logs.length - 1] : null;
        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: data.status,
                lastLog: last ? `[${last.status}] ${last.step}: ${last.message}` : prev.lastLog,
              }
            : prev
        );
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: data.status,
                  error: data.status === "FAILED" ? data.error || "Échec de génération" : null,
                  articleId: data.result?.articleId ?? null,
                }
              : prev
          );
          return;
        }
      } catch {
        // keep polling
      }
    }
    setJob((prev) =>
      prev ? { ...prev, lastLog: "Toujours en cours en arrière-plan…" } : prev
    );
  }

  function handleQueued(queued: QueuedArticleJob) {
    setJob({
      jobId: queued.jobId,
      articleType: queued.articleType,
      category: queued.category,
      status: "PENDING",
      lastLog: "En file d'attente — le worker va la prendre en charge…",
      error: null,
      articleId: null,
    });
    pollJob(queued.jobId);
  }

  function resetAll() {
    setJob(null);
    setCatalogueId("");
  }

  const done = job && (job.status === "COMPLETED" || job.status === "FAILED");

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nouvel article</h1>
          <Link href="/admin/articles" className="text-blue-600 hover:underline text-sm">
            ← Retour aux articles
          </Link>
        </div>

        {/* Step 1 — catalogue */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
            1. Catalogue source
          </h2>
          {loadError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {loadError}
            </p>
          )}
          {!catalogues && !loadError && (
            <p className="text-sm text-gray-500">Chargement des catalogues…</p>
          )}
          {catalogues && (
            <select
              value={catalogueId}
              onChange={(e) => {
                setCatalogueId(e.target.value);
                setJob(null);
              }}
              disabled={!!job && !done}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="">Choisir un catalogue…</option>
              {catalogues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} — {c.status} — {c.offerCount} offres ({fmtDate(c.startDate)} → {fmtDate(c.endDate)})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Step 2 — intent */}
        {selected && (!job || job.status === "FAILED") && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
              2. Type d&apos;article
            </h2>
            <ArticleTypePicker
              key={selected.id}
              inline
              catalogueId={selected.id}
              catalogueTitle={selected.title}
              onClose={() => {}}
              onQueued={handleQueued}
            />
          </div>
        )}

        {/* Step 3 — progress */}
        {job && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
              3. Génération
            </h2>
            {job.status === "COMPLETED" && job.articleId ? (
              <div>
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
                  Article généré et vérifié.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/articles/${job.articleId}`}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    Relire l&apos;article
                  </Link>
                  <button
                    onClick={resetAll}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    Créer un autre article
                  </button>
                </div>
              </div>
            ) : job.status === "FAILED" ? (
              <div>
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  {job.error || "Échec de génération"}
                </p>
                <button
                  onClick={() => setJob(null)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                >
                  Réessayer un autre type
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Génération en cours…
                </div>
                {job.lastLog && (
                  <p className="mt-3 text-xs font-mono text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 truncate" title={job.lastLog}>
                    {job.lastLog}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Chargement…</div>}>
      <NewArticlePageInner />
    </Suspense>
  );
}
