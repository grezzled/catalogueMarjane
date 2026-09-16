"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  catalogues: number;
  pagesProcessed: number;
  productsExtracted: number;
  offersExtracted: number;
  articlesGenerated: number;
  articlesPublished: number;
  articlesAwaitingReview: number;
  aiErrors: number;
  productsMissingImages: number;
  productsWithoutBoxes: number;
  pagesWithoutBoxes: number;
  cataloguesMissingOriginals: number;
  cataloguesTotal: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillReanalyze, setBackfillReanalyze] = useState(false);
  const [originalsRunning, setOriginalsRunning] = useState(false);
  const [originalsMsg, setOriginalsMsg] = useState<string | null>(null);
  const [originalsForce, setOriginalsForce] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  async function handleRegenerateOriginals() {
    if (originalsRunning) return;
    setOriginalsRunning(true);
    setOriginalsMsg(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "REGENERATE_ORIGINALS",
          ...(originalsForce ? { force: true } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.jobId) {
        setOriginalsMsg(
          data.queued === false
            ? "Already running — watch the Workers terminal."
            : "Queued — watch the Workers terminal for progress."
        );
      } else {
        setOriginalsMsg(data?.error || "Failed to queue.");
      }
    } catch {
      setOriginalsMsg("Network error.");
    } finally {
      setOriginalsRunning(false);
    }
  }

  async function handleBackfill() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillMsg(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "BACKFILL_PRODUCT_IMAGES",
          ...(backfillReanalyze ? { reanalyzeMissing: true } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.jobId) {
        setBackfillMsg(
          data.queued === false
            ? "Backfill already running — watch the Workers terminal."
            : "Backfill queued — watch the Workers terminal for progress."
        );
      } else {
        setBackfillMsg(data?.error || "Failed to queue backfill.");
      }
    } catch {
      setBackfillMsg("Network error.");
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Admin Dashboard
        </h1>

        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Catalogues" value={stats.catalogues} />
            <StatCard title="Pages Processed" value={stats.pagesProcessed} />
            <StatCard title="Products Extracted" value={stats.productsExtracted} />
            <StatCard title="Offers Extracted" value={stats.offersExtracted} />
            <StatCard title="Articles Generated" value={stats.articlesGenerated} />
            <StatCard title="Published" value={stats.articlesPublished} color="green" />
            <StatCard title="Awaiting Review" value={stats.articlesAwaitingReview} color="yellow" />
            <StatCard title="AI Errors" value={stats.aiErrors} color="red" />
          </div>
        ) : (
          <div className="text-center py-12">Loading stats...</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/catalogues"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Manage Catalogues
            </h2>
            <p className="text-gray-600">
              Upload, process, and manage Marjane catalogues
            </p>
          </Link>

          <Link
            href="/admin/articles"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Manage Articles
            </h2>
            <p className="text-gray-600">
              Review, approve, and publish SEO articles
            </p>
          </Link>
        </div>

        <div className="mt-6 p-6 bg-white rounded-lg shadow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                Maintenance
              </h2>
              <p className="text-gray-600 text-sm">
                Crop missing product images from stored page analyses across all
                catalogues. No AI calls — safe to re-run anytime.
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {(stats?.productsMissingImages ?? 0).toLocaleString()}{" "}
                <span className="text-sm font-medium text-gray-500">
                  produit{(stats?.productsMissingImages ?? 0) !== 1 ? "s" : ""} sans image
                  {stats && stats.productsExtracted > 0 && (
                    <> ({Math.round((stats.productsMissingImages / stats.productsExtracted) * 100)}%)</>
                  )}
                </span>
              </p>
              <p className="mt-1 text-sm text-gray-600" title="Détections brutes dans les analyses IA (pas des produits) : un même produit peut être détecté sur plusieurs pages, et des produits déjà imagés peuvent apparaître sans box ailleurs.">
                <span className="font-bold text-gray-900">{(stats?.productsWithoutBoxes ?? 0).toLocaleString()}</span>{" "}
                détections IA sans bounding box
                {(stats?.pagesWithoutBoxes ?? 0) > 0 && (
                  <span className="text-gray-500"> · {(stats?.pagesWithoutBoxes ?? 0).toLocaleString()} pages concernées</span>
                )}
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backfillReanalyze}
                  onChange={(e) => setBackfillReanalyze(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Aussi relancer l&apos;IA sur les pages sans boxes
                  <span className="block text-xs text-gray-500">
                    Enqueues AI re-analysis jobs for pages with box-less products
                    (uses Gemini quota; newly detected boxes get cropped automatically).
                  </span>
                </span>
              </label>
              {backfillMsg && (
                <p className="mt-2 text-sm text-blue-700">{backfillMsg}</p>
              )}
            </div>
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {backfilling ? "Queueing..." : "Compléter les images produits"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-gray-600 text-sm">
                Régénère les JPEG pleine résolution (200 DPI) depuis les PDF —
                l&apos;IA les préfère aux WebP pour l&apos;analyse.
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {(stats?.cataloguesMissingOriginals ?? 0).toLocaleString()}
                <span className="text-sm font-medium text-gray-500">
                  {" "}/ {(stats?.cataloguesTotal ?? 0).toLocaleString()} catalogues sans originaux
                </span>
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={originalsForce}
                  onChange={(e) => setOriginalsForce(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Forcer (régénère même si présents)
                </span>
              </label>
              {originalsMsg && (
                <p className="mt-2 text-sm text-blue-700">{originalsMsg}</p>
              )}
            </div>
            <button
              onClick={handleRegenerateOriginals}
              disabled={originalsRunning}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {originalsRunning ? "Queueing..." : "Régénérer les originaux"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color = "blue",
}: {
  title: string;
  value: number;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-900",
    green: "bg-green-50 text-green-900",
    yellow: "bg-yellow-50 text-yellow-900",
    red: "bg-red-50 text-red-900",
  };

  return (
    <div className={`p-6 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
