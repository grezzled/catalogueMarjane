"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Insight {
  type: "no-impressions" | "low-ctr" | "striking-distance" | "not-indexed";
  severity: "info" | "warning" | "critical";
  message: string;
}

interface SeoRow {
  url: string;
  kind: string;
  title?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  hasData: boolean;
  indexVerdict: string | null;
  inspectedAt: string | null;
  insights: Insight[];
}

interface Dashboard {
  setup: { configured: boolean; error: string | null };
  window: { windowStart: string; windowEnd: string; days: number } | null;
  rows: SeoRow[];
}

const WINDOW_OPTIONS = [
  { days: 7, label: "7 jours" },
  { days: 28, label: "28 jours" },
  { days: 90, label: "3 mois" },
  { days: 180, label: "6 mois" },
  { days: 365, label: "12 mois" },
];

const INSIGHT_LABEL: Record<Insight["type"], string> = {
  "no-impressions": "Zero impressions",
  "low-ctr": "Low CTR",
  "striking-distance": "Striking distance",
  "not-indexed": "Not indexed",
};

function severityClass(severity: Insight["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function verdictBadge(verdict: string | null): React.ReactNode {
  if (!verdict) return <span className="text-gray-400">—</span>;
  const ok = verdict === "PASS";
  const warn = verdict === "PARTIAL";
  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
        ok ? "bg-green-100 text-green-800" : warn ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
      }`}
      title={verdict}
    >
      {ok ? "Indexed" : warn ? "Partial" : verdict}
    </span>
  );
}

export default function SeoDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [days, setDays] = useState(28);

  async function fetchDashboard(selectedDays: number) {
    try {
      const res = await fetch(`/api/seo/performance?days=${selectedDays}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to fetch SEO dashboard:", err);
    }
  }

  useEffect(() => {
    fetch(`/api/seo/performance?days=${days}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (r.ok && body && Array.isArray(body.rows)) {
          setData(body);
        } else {
          setLoadError(body?.error || `Dashboard request failed (${r.status}).`);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch SEO dashboard:", err);
        setLoadError("Network error loading the dashboard.");
      })
      .finally(() => setLoading(false));
  }, [days]);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/seo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setSyncMsg(`Synced ${body.rows} URLs from Search Console.`);
        fetchDashboard(days);
      } else {
        setSyncMsg(body?.error || "Sync failed.");
      }
    } catch {
      setSyncMsg("Network error.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleInspect(url: string) {
    if (inspecting[url]) return;
    setInspecting((prev) => ({ ...prev, [url]: true }));
    try {
      const res = await fetch("/api/seo/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) fetchDashboard(days);
    } catch (err) {
      console.error("Inspect error:", err);
    } finally {
      setInspecting((prev) => ({ ...prev, [url]: false }));
    }
  }

  const rows = useMemo(
    () => (Array.isArray(data?.rows) ? (data.rows as SeoRow[]) : []),
    [data]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const row of rows) {
      for (const i of row.insights) {
        c[i.type] = (c[i.type] ?? 0) + 1;
      }
    }
    return c;
  }, [rows]);

  const totals = useMemo(() => {
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0 };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && !row.insights.some((i) => i.type === filter)) return false;
      if (q && !row.url.toLowerCase().includes(q) && !(row.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SEO Dashboard</h1>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => {
                setDays(parseInt(e.target.value, 10));
                setLoading(true);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Data window"
            >
              {WINDOW_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? "Syncing..." : "Sync Search Console"}
            </button>
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline text-sm">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {data && !data.setup.configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            <p className="font-semibold mb-1">Search Console not connected</p>
            <p>{data.setup.error}</p>
            <p className="mt-1 text-amber-700">
              Showing your URL inventory below — connect GSC to fill in clicks, impressions and positions.
            </p>
          </div>
        )}

        {syncMsg && (
          <p className="mb-4 text-sm text-blue-700">{syncMsg}</p>
        )}

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
            <p className="font-semibold mb-1">Couldn&apos;t load SEO data</p>
            <p>{loadError}</p>
            <p className="mt-1 text-red-700">
              If you just pulled schema changes, restart the dev server so Prisma picks up the new tables.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Clicks ({days}d)</p>
                <p className="text-2xl font-bold text-gray-900">{totals.clicks.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Impressions ({days}d)</p>
                <p className="text-2xl font-bold text-gray-900">{totals.impressions.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Avg CTR</p>
                <p className="text-2xl font-bold text-gray-900">{(totals.ctr * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Data window</p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {data?.window
                    ? `${new Date(data.window.windowStart).toLocaleDateString("fr-FR")} → ${new Date(data.window.windowEnd).toLocaleDateString("fr-FR")}`
                    : "No sync yet — pick a window and Sync"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "all" ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}
              >
                All ({counts.all ?? 0})
              </button>
              {(Object.keys(INSIGHT_LABEL) as Array<keyof typeof INSIGHT_LABEL>).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(filter === key ? "all" : key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === key ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}
                >
                  {INSIGHT_LABEL[key]} ({counts[key] ?? 0})
                </button>
              ))}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by URL or title..."
                className="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impr.</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pos.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Indexed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insight</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {visible.map((row) => (
                      <tr key={row.url} className="hover:bg-gray-50">
                        <td className="px-4 py-3 max-w-xs">
                          <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium block truncate" title={row.url}>
                            {row.title || row.url}
                          </a>
                          <p className="text-xs text-gray-400 truncate" title={row.url}>
                            {row.url.replace(/^https?:\/\/[^/]+/, "") || "/"} · {row.kind}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{(row.ctr * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.position != null ? row.position.toFixed(1) : "—"}</td>
                        <td className="px-4 py-3">{verdictBadge(row.indexVerdict)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {row.insights.length === 0 && <span className="text-gray-400 text-xs">—</span>}
                            {row.insights.map((insight) => (
                              <span
                                key={insight.type}
                                className={`inline-flex w-fit px-2 py-0.5 text-xs font-medium rounded-full ${severityClass(insight.severity)}`}
                                title={insight.message}
                              >
                                {INSIGHT_LABEL[insight.type]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleInspect(row.url)}
                            disabled={!!inspecting[row.url]}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                            title="Run URL Inspection (quota-limited)"
                          >
                            {inspecting[row.url] ? "Checking..." : "Inspect"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visible.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No URLs match this filter.</p>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Inspect uses the URL Inspection API (~2,000 checks/day) — run it on demand, not in bulk.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
