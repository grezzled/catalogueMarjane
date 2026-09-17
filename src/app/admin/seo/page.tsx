"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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

interface HistoryPoint {
  windowEnd: string;
  days: number;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
}

interface ContentIssue {
  slug: string;
  title: string;
  status: string;
  seoScore: number | null;
  thinContentRisk: number | null;
  keywordStuffingRisk: number | null;
  missingMeta: string[];
  incomingLinks: number;
  outgoingLinks: number;
}

interface Dashboard {
  setup: { configured: boolean; error: string | null };
  window: { windowStart: string; windowEnd: string; days: number } | null;
  rows: SeoRow[];
  history: HistoryPoint[];
  delta: { clicks: number; impressions: number; ctr: number; avgPosition: number | null } | null;
  avgPosition: number | null;
  content: {
    publishedCount: number;
    draftCount: number;
    avgSeoScore: number | null;
    thinRiskCount: number;
    stuffingRiskCount: number;
    missingMetaCount: number;
    orphanCount: number;
    issues: ContentIssue[];
  };
  technical: {
    indexed: number;
    partial: number;
    failing: number;
    unchecked: number;
    inventoryCount: number;
    gscCoverage: number;
    sitemap: { urlCount: number | null; lastModified: string | null };
    metaGaps: { articlesMissingTitle: number; articlesMissingDescription: number; cataloguesMissingDescription: number };
  };
}

interface QueryRow {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
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

const KIND_LABEL: Record<string, string> = {
  home: "Home",
  catalogues: "Catalogues",
  catalogue: "Catalogue",
  promotions: "Promotions",
  articles: "Articles",
  article: "Article",
  category: "Category",
};

type Tab = "overview" | "performance" | "content" | "technical" | "live";
type SortKey = "url" | "clicks" | "impressions" | "ctr" | "position";
const PAGE_SIZE = 25;

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

function verdictBadge(verdict: string | null): ReactNode {
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

function deltaClass(value: number, invert = false): string {
  if (value === 0) return "text-gray-400";
  const good = invert ? value < 0 : value > 0;
  return good ? "text-green-600" : "text-red-600";
}

function fmtDelta(value: number, suffix = ""): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString()}${suffix}`;
}

type TrendMetric = "impressions" | "clicks" | "ctr" | "position";

const TREND_METRICS: { id: TrendMetric; label: string; color: string }[] = [
  { id: "impressions", label: "Impressions", color: "#2563eb" },
  { id: "clicks", label: "Clicks", color: "#16a34a" },
  { id: "ctr", label: "CTR %", color: "#d97706" },
  { id: "position", label: "Position", color: "#7c3aed" },
];

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

/** One chart point = actual values for a single day (or a synced window as fallback). */
interface TrendPoint {
  date: string;
  sub?: string;
  impressions: number;
  clicks: number;
  /** ratio, not percent */
  ctr: number;
  position: number | null;
}

interface DailyPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface LiveBucket {
  hour: string;
  views: number;
}

interface LiveData {
  hours: LiveBucket[];
  total: number;
  top: { path: string; views: number }[];
}

/** Interactive SVG trend chart (no new deps): metric switch + hover tooltip. */
function TrendChart({ points: input }: { points: TrendPoint[] }) {
  const [metric, setMetric] = useState<TrendMetric>("impressions");
  const [hover, setHover] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number; wrapW: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const points = input.slice(-180);

  function rawValue(p: TrendPoint): number | null {
    switch (metric) {
      case "impressions": return p.impressions;
      case "clicks": return p.clicks;
      case "ctr": return p.ctr * 100;
      case "position": return p.position;
    }
  }

  const W = 640, H = 210, padL = 48, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = points.map(rawValue);
  const nums = vals.filter((v): v is number => v != null);
  const color = TREND_METRICS.find((m) => m.id === metric)?.color ?? "#2563eb";
  const invert = metric === "position"; // lower position = better → up = better
  const zeroBased = metric === "impressions" || metric === "clicks";

  if (points.length < 2 || nums.length < 2) {
    return <p className="text-sm text-gray-400">Not enough history yet — sync at least twice for the same window.</p>;
  }

  const lo = zeroBased ? 0 : Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const x = (i: number) => padL + (i * plotW) / Math.max(points.length - 1, 1);
  const y = (v: number) => {
    const t = (v - lo) / span;
    return invert ? padT + t * plotH : padT + (1 - t) * plotH;
  };
  const line = points.map((p, i) => { const v = vals[i]; return v == null ? "" : `${i === 0 || vals[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).join(" ");
  const baseY = invert ? padT : padT + plotH;
  const firstIdx = vals.findIndex((v) => v != null);
  const area = `${line} L${x(points.length - 1).toFixed(1)},${baseY} L${x(firstIdx).toFixed(1)},${baseY} Z`;

  const ticks = [0, 1, 2, 3].map((t) => lo + (span * t) / 3);
  const fmtTick = (v: number) => (metric === "ctr" ? `${v.toFixed(1)}%` : metric === "position" ? v.toFixed(1) : compact(v));
  const labelIdx = points.map((_, i) => i).filter((i) => i % Math.ceil(points.length / 6) === 0);

  const first = nums[0], last = nums[nums.length - 1];
  const change = last - first;
  const fmtVal = (v: number) => (metric === "ctr" ? `${v.toFixed(1)}%` : metric === "position" ? v.toFixed(1) : compact(v));
  const fmtDate = (iso: string) => {
    const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
    return isNaN(+d) ? iso : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current, wrap = wrapRef.current;
    if (!svg || !wrap) return;
    // Map client coords through the SVG transform (getScreenCTM), NOT a
    // naive width ratio: `meet` letterboxing otherwise shifts the hovered
    // point and the tooltip shows a neighbour's data.
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((p.x - padL) / plotW) * (points.length - 1))));
    setHover(i);
    // Anchor the tooltip to the hovered dot's on-screen position.
    const v = vals[i];
    const dot = new DOMPoint(x(i), v == null ? padT + plotH / 2 : y(v)).matrixTransform(ctm);
    const wr = wrap.getBoundingClientRect();
    setTipPos({ left: dot.x - wr.left, top: dot.y - wr.top, wrapW: wr.width });
  }

  function onLeave() {
    setHover(null);
    setTipPos(null);
  }

  const hp = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {TREND_METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMetric(m.id); setHover(null); setTipPos(null); }}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${metric === m.id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            style={metric === m.id ? { backgroundColor: m.color } : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="relative" ref={wrapRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-52 cursor-crosshair" onMouseMove={onMove} onMouseLeave={onLeave}>
          <defs>
            <linearGradient id={`tg-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{fmtTick(t)}</text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
              {fmtDate(points[i].date)}
            </text>
          ))}
          <path d={area} fill={`url(#tg-${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
          {points.map((p, i) => vals[i] == null ? null : (
            <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(vals[i] as number)} r={hover === i ? 5 : 3} fill={color} stroke="#fff" strokeWidth={1.5} />
          ))}
        </svg>
        {hp && tipPos && (
          <div
            className="absolute z-10 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
            style={{
              left: Math.max(72, Math.min(tipPos.wrapW - 72, tipPos.left)),
              top: Math.max(4, tipPos.top - 8),
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-semibold">{fmtDate(hp.date)}{hp.sub ? ` · ${hp.sub}` : ""}</p>
            <p>Impr.: {hp.impressions.toLocaleString()} · Clicks: {hp.clicks.toLocaleString()}</p>
            <p>CTR: {(hp.ctr * 100).toFixed(1)}% · Pos.: {hp.position != null ? hp.position.toFixed(1) : "—"}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
        <span>Last: <span className="font-bold text-gray-900">{fmtVal(last)}</span></span>
        <span className={`font-medium ${deltaClass(metric === "position" ? -change : change)}`}>
          {change === 0 ? "→ stable" : `${change > 0 ? "↗ +" : "↘ "}${fmtVal(change).replace("-", "")} since ${fmtDate(points[0].date)}`}
        </span>
        <span className="ml-auto">{fmtDate(points[0].date)} → {fmtDate(points[points.length - 1].date)} · {points.length} days</span>
      </div>
    </div>
  );
}

/** Hourly bar chart (pure HTML bars — no coordinate mapping pitfalls). */
function LiveChart({ buckets }: { buckets: LiveBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = buckets.length;
  const max = Math.max(...buckets.map((b) => b.views), 1);
  if (n === 0) return <p className="text-sm text-gray-400">No data.</p>;
  const step = Math.ceil(n / 8);
  const fmtHour = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(+d)) return iso;
    return n <= 48
      ? `${String(d.getHours()).padStart(2, "0")}h`
      : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };
  const hb = hover != null ? buckets[hover] : null;
  return (
    <div className="relative">
      <div className="relative h-44">
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${f * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {buckets.map((b, i) => (
            <div
              key={b.hour}
              className="flex-1 h-full flex flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="w-full rounded-t transition-colors"
                style={{
                  height: `${(b.views / max) * 100}%`,
                  minHeight: b.views > 0 ? 3 : 0,
                  backgroundColor: hover === i ? "#1d4ed8" : "#60a5fa",
                }}
              />
            </div>
          ))}
        </div>
        {hb && hover != null && (
          <div
            className="absolute z-10 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
            style={{ left: `${((hover + 0.5) / n) * 100}%`, top: 0, transform: "translate(-50%, -110%)" }}
          >
            <p className="font-semibold">
              {new Date(hb.hour).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}{" "}
              {String(new Date(hb.hour).getHours()).padStart(2, "0")}h00
            </p>
            <p>{hb.views} vue{hb.views !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
      <div className="relative h-5 mt-1 text-[10px] text-gray-400">
        {buckets.map((b, i) =>
          i % step === 0 ? (
            <span key={b.hour} className="absolute" style={{ left: `${((i + 0.5) / n) * 100}%`, transform: "translateX(-50%)" }}>
              {fmtHour(b.hour)}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

export default function SeoDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("impressions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [days, setDays] = useState(28);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [queriesCache, setQueriesCache] = useState<Record<string, QueryRow[]>>({});
  const [queriesLoading, setQueriesLoading] = useState<string | null>(null);
  const [trendUrl, setTrendUrl] = useState<string>("all");
  const [trendCache, setTrendCache] = useState<Record<string, HistoryPoint[]>>({});
  /** key `${days}|${url}` → daily points, or null when GSC daily is unavailable (fallback to windows) */
  const [dailyCache, setDailyCache] = useState<Record<string, DailyPoint[] | null>>({});
  const [liveHours, setLiveHours] = useState(24);
  const [liveScope, setLiveScope] = useState<string>("all");
  /** key `${hours}|${path}` → live data, or null on error */
  const [liveCache, setLiveCache] = useState<Record<string, LiveData | null>>({});

  async function fetchDashboard(selectedDays: number) {
    try {
      const res = await fetch(`/api/seo/performance?days=${selectedDays}`);
      if (res.ok) {
        setData(await res.json());
        setTrendCache({});
        setDailyCache({});
      }
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
          setLoadError(null);
        } else {
          setLoadError(body?.error || `Dashboard request failed (${r.status}).`);
        }
      })
      .catch(() => setLoadError("Network error loading the dashboard."))
      .finally(() => setLoading(false));
  }, [days]);

  // Reset pagination whenever a filter changes.
  function updateFilter(setter: () => void) {
    setter();
    setPage(0);
  }

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

  async function toggleQueries(url: string) {
    if (expanded === url) { setExpanded(null); return; }
    setExpanded(url);
    if (queriesCache[url] || !data?.setup.configured) return;
    setQueriesLoading(url);
    try {
      const res = await fetch(`/api/seo/queries?days=${days}&limit=10&url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const body = await res.json();
        setQueriesCache((prev) => ({ ...prev, [url]: body.rows ?? [] }));
      }
    } catch (err) {
      console.error("Queries error:", err);
    } finally {
      setQueriesLoading(null);
    }
  }

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);

  const topUrls = useMemo(() => [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, 15), [rows]);

  const dailyKey = `${days}|${trendUrl}`;
  const dailyEntry = dailyCache[dailyKey]; // undefined = loading, null = unavailable
  const fallbackHist = trendUrl === "all" ? data?.history : trendCache[trendUrl];

  // Actual per-day values from Search Console; synced window aggregates as fallback.
  const trendMode: "daily" | "windows" | null = dailyEntry ? "daily" : dailyEntry === null && fallbackHist ? "windows" : null;
  const trendPoints: TrendPoint[] | undefined = dailyEntry
    ? dailyEntry.map((d) => ({
        date: d.date,
        impressions: d.impressions,
        clicks: d.clicks,
        ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
        position: d.impressions > 0 ? d.position : null,
      }))
    : dailyEntry === null && fallbackHist
      ? fallbackHist.map((p) => ({
          date: p.windowEnd,
          sub: `${p.days}d window`,
          impressions: p.impressions,
          clicks: p.clicks,
          ctr: p.ctr,
          position: p.avgPosition,
        }))
      : undefined;
  const trendPending = trendPoints === undefined;

  // Fetch daily series when the overview tab needs it (async callbacks only —
  // no sync setState here). On failure, fall back to window aggregates.
  useEffect(() => {
    if (tab !== "overview" || !data) return;
    const key = `${days}|${trendUrl}`;
    if (dailyCache[key] !== undefined) {
      if (dailyCache[key] === null && trendUrl !== "all" && trendCache[trendUrl] === undefined) {
        fetch(`/api/seo/history?url=${encodeURIComponent(trendUrl)}`)
          .then(async (r) => {
            const body = await r.json().catch(() => null);
            setTrendCache((prev) => ({ ...prev, [trendUrl]: r.ok && Array.isArray(body?.history) ? body.history : [] }));
          })
          .catch(() => setTrendCache((prev) => ({ ...prev, [trendUrl]: [] })));
      }
      return;
    }
    const params = new URLSearchParams({ days: String(Math.min(Math.max(days, 1), 180)) });
    if (trendUrl !== "all") params.set("url", trendUrl);
    fetch(`/api/seo/daily?${params.toString()}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        setDailyCache((prev) => ({ ...prev, [key]: r.ok && Array.isArray(body?.days) ? body.days : null }));
      })
      .catch(() => setDailyCache((prev) => ({ ...prev, [key]: null })));
  }, [tab, days, trendUrl, data, dailyCache, trendCache]);

  // Live 24h data (first-party beacon). Refreshed every 60s while visible.
  const liveKey = `${liveHours}|${liveScope}`;
  const liveEntry = liveCache[liveKey]; // undefined = loading, null = error
  useEffect(() => {
    if (tab !== "live") return;
    if (liveCache[liveKey] !== undefined) return;
    const params = new URLSearchParams({ hours: String(liveHours) });
    if (liveScope !== "all") params.set("path", liveScope);
    fetch(`/api/views?${params.toString()}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        setLiveCache((prev) => ({ ...prev, [liveKey]: r.ok && Array.isArray(body?.hours) ? body : null }));
      })
      .catch(() => setLiveCache((prev) => ({ ...prev, [liveKey]: null })));
  }, [tab, liveHours, liveScope, liveCache, liveKey]);
  useEffect(() => {
    if (tab !== "live") return;
    const t = setInterval(() => {
      setLiveCache((prev) => {
        if (prev[liveKey] === undefined) return prev;
        const next = { ...prev };
        delete next[liveKey];
        return next;
      });
    }, 60000);
    return () => clearInterval(t);
  }, [tab, liveKey]);

  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))].sort(), [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const row of rows) {
      for (const i of row.insights) c[i.type] = (c[i.type] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const totals = useMemo(() => {
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0 };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && !row.insights.some((i) => i.type === filter)) return false;
      if (kind !== "all" && row.kind !== kind) return false;
      if (hideZero && row.impressions === 0) return false;
      if (q && !row.url.toLowerCase().includes(q) && !(row.title || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, kind, query, hideZero]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "url": return a.url.localeCompare(b.url) * dir;
        case "clicks": return (a.clicks - b.clicks) * dir;
        case "impressions": return (a.impressions - b.impressions) * dir;
        case "ctr": return (a.ctr - b.ctr) * dir;
        case "position": return ((a.position ?? 999) - (b.position ?? 999)) * dir;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = useMemo(() => sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE), [sorted, safePage]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "url" ? "asc" : "desc"); }
  }

  function sortArrow(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function exportCsv() {
    const header = "url,kind,title,clicks,impressions,ctr,position,indexed,insights";
    const lines = sorted.map((r) =>
      [r.url, r.kind, `"${(r.title || "").replace(/"/g, '""')}"`, r.clicks, r.impressions, (r.ctr * 100).toFixed(2), r.position?.toFixed(1) ?? "", r.indexVerdict ?? "", r.insights.map((i) => i.type).join("|")]
        .join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seo-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const actions = useMemo(() => {
    if (!data) return [];
    const list: { label: string; detail: string; severity: Insight["severity"] }[] = [];
    for (const r of rows) {
      for (const i of r.insights) {
        if (list.length >= 30) break;
        list.push({ label: `${INSIGHT_LABEL[i.type]} — ${r.title || r.url}`, detail: i.message, severity: i.severity });
      }
    }
    for (const a of data.content.issues.slice(0, 10)) {
      list.push({
        label: `Article à améliorer — ${a.title}`,
        detail: `SEO ${a.seoScore ?? "—"}${a.missingMeta.length ? ` · meta manquante: ${a.missingMeta.join(", ")}` : ""}${a.incomingLinks === 0 ? " · aucun lien entrant" : ""}`,
        severity: (a.seoScore ?? 100) < 50 ? "critical" : "warning",
      });
    }
    if (data.technical.metaGaps.articlesMissingDescription > 0) {
      list.push({ label: `${data.technical.metaGaps.articlesMissingDescription} articles sans meta description`, detail: "Complétez les meta descriptions pour améliorer le CTR.", severity: "warning" });
    }
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    return list.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 8);
  }, [data, rows]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "performance", label: `Performance (${rows.length})` },
    { id: "content", label: `Contenu (${data?.content.publishedCount ?? 0})` },
    { id: "technical", label: "Technique" },
    { id: "live", label: "Live 24h" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">SEO Dashboard</h1>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => { setDays(parseInt(e.target.value, 10)); setLoading(true); setPage(0); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Data window"
            >
              {WINDOW_OPTIONS.map((opt) => (
                <option key={opt.days} value={opt.days}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? "Syncing..." : "Sync Search Console"}
            </button>
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {data && !data.setup.configured && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            <p className="font-semibold mb-1">Search Console not connected</p>
            <p>{data.setup.error}</p>
            <p className="mt-1 text-amber-700">Showing your URL inventory below — connect GSC to fill in clicks, impressions and positions.</p>
          </div>
        )}
        {syncMsg && <p className="mb-4 text-sm text-blue-700">{syncMsg}</p>}
        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
            <p className="font-semibold mb-1">Couldn&apos;t load SEO data</p>
            <p>{loadError}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : data && (
          <>
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Clicks ({days}d)</p>
                    <p className="text-2xl font-bold text-gray-900">{totals.clicks.toLocaleString()}</p>
                    {data.delta && <p className={`text-xs font-medium ${deltaClass(data.delta.clicks)}`}>{fmtDelta(data.delta.clicks)} vs prev.</p>}
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Impressions ({days}d)</p>
                    <p className="text-2xl font-bold text-gray-900">{totals.impressions.toLocaleString()}</p>
                    {data.delta && <p className={`text-xs font-medium ${deltaClass(data.delta.impressions)}`}>{fmtDelta(data.delta.impressions)} vs prev.</p>}
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Avg CTR</p>
                    <p className="text-2xl font-bold text-gray-900">{(totals.ctr * 100).toFixed(1)}%</p>
                    {data.delta && <p className={`text-xs font-medium ${deltaClass(data.delta.ctr * 100)}`}>{fmtDelta(data.delta.ctr * 100, " pts")} vs prev.</p>}
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Avg position</p>
                    <p className="text-2xl font-bold text-gray-900">{data.avgPosition != null ? data.avgPosition.toFixed(1) : "—"}</p>
                    {data.delta?.avgPosition != null && <p className={`text-xs font-medium ${deltaClass(data.delta.avgPosition, true)}`}>{fmtDelta(Number(data.delta.avgPosition.toFixed(1)))} vs prev.</p>}
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-sm text-gray-500">Indexed</p>
                    <p className="text-2xl font-bold text-gray-900">{data.technical.indexed}<span className="text-sm font-normal text-gray-400">/{data.technical.inventoryCount}</span></p>
                    <p className="text-xs text-gray-500 mt-1">Sitemap: {data.technical.sitemap.urlCount ?? "—"} URLs</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h2 className="font-semibold text-gray-900">Trend</h2>
                      <select
                        value={trendUrl}
                        onChange={(e) => setTrendUrl(e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white max-w-64"
                        title="Trend scope"
                      >
                        <option value="all">Tout le site</option>
                        {topUrls.map((r) => (
                          <option key={r.url} value={r.url}>{r.title || r.url}</option>
                        ))}
                      </select>
                    </div>
                    {trendPending ? (
                      <p className="text-sm text-gray-400">Loading daily trend...</p>
                    ) : trendPoints && trendPoints.length >= 2 ? (
                      <>
                        <TrendChart points={trendPoints} />
                        {trendMode === "windows" && (
                          <p className="mt-1 text-xs text-amber-600">Daily API unavailable — showing synced window totals.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">No trend data yet — sync Search Console first.</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      {data.window ? `${new Date(data.window.windowStart).toLocaleDateString("fr-FR")} → ${new Date(data.window.windowEnd).toLocaleDateString("fr-FR")}` : "No sync yet — pick a window and Sync"}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="font-semibold text-gray-900 mb-2">Actions prioritaires</h2>
                    {actions.length === 0 && <p className="text-sm text-gray-500">Rien à signaler 🎉</p>}
                    <ul className="space-y-2">
                      {actions.map((a, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className={`mt-0.5 inline-flex h-fit px-2 py-0.5 text-xs font-medium rounded-full ${severityClass(a.severity)}`}>{a.severity}</span>
                          <div>
                            <p className="font-medium text-gray-900">{a.label}</p>
                            <p className="text-gray-500 text-xs">{a.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}

            {tab === "performance" && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button onClick={() => updateFilter(() => setFilter("all"))} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "all" ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}>
                    All ({counts.all ?? 0})
                  </button>
                  {(Object.keys(INSIGHT_LABEL) as Array<keyof typeof INSIGHT_LABEL>).map((key) => (
                    <button key={key} onClick={() => updateFilter(() => setFilter(filter === key ? "all" : key))} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === key ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}>
                      {INSIGHT_LABEL[key]} ({counts[key] ?? 0})
                    </button>
                  ))}
                  <select value={kind} onChange={(e) => updateFilter(() => setKind(e.target.value))} className="px-3 py-1.5 text-xs border border-gray-300 rounded-full bg-white" title="Filter by page type">
                    <option value="all">All types</option>
                    {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-600 ml-1">
                    <input type="checkbox" checked={hideZero} onChange={(e) => updateFilter(() => setHideZero(e.target.checked))} /> Hide zero-impr.
                  </label>
                  <input type="text" value={query} onChange={(e) => updateFilter(() => setQuery(e.target.value))} placeholder="Filter by URL or title..." className="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
                  <button onClick={exportCsv} className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50">Export CSV</button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort("url")}>URL{sortArrow("url")}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort("clicks")}>Clicks{sortArrow("clicks")}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort("impressions")}>Impr.{sortArrow("impressions")}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort("ctr")}>CTR{sortArrow("ctr")}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer select-none" onClick={() => toggleSort("position")}>Pos.{sortArrow("position")}</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Indexed</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insight</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paged.map((row) => (
                          <Fragment key={row.url}>
                            <tr key={row.url} className="hover:bg-gray-50">
                              <td className="px-4 py-3 max-w-xs">
                                <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium block truncate" title={row.url}>{row.title || row.url}</a>
                                <p className="text-xs text-gray-400 truncate" title={row.url}>{row.url.replace(/^https?:\/\/[^/]+/, "") || "/"} · {KIND_LABEL[row.kind] ?? row.kind}</p>
                                {data.setup.configured && (
                                  <button onClick={() => toggleQueries(row.url)} className="text-xs text-gray-500 hover:text-blue-600 hover:underline mt-0.5">
                                    {expanded === row.url ? "Hide queries ▴" : "Top queries ▾"}
                                  </button>
                                )}
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
                                    <span key={insight.type} className={`inline-flex w-fit px-2 py-0.5 text-xs font-medium rounded-full ${severityClass(insight.severity)}`} title={insight.message}>
                                      {INSIGHT_LABEL[insight.type]}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <button onClick={() => handleInspect(row.url)} disabled={!!inspecting[row.url]} className="text-xs text-blue-600 hover:underline disabled:opacity-50" title="Run URL Inspection (quota-limited)">
                                  {inspecting[row.url] ? "Checking..." : "Inspect"}
                                </button>
                              </td>
                            </tr>
                            {expanded === row.url && (
                              <tr key={`${row.url}-queries`} className="bg-blue-50/50">
                                <td colSpan={8} className="px-8 py-3">
                                  {queriesLoading === row.url && <p className="text-xs text-gray-500">Loading queries...</p>}
                                  {queriesLoading !== row.url && (queriesCache[row.url] ?? []).length === 0 && (
                                    <p className="text-xs text-gray-500">No query data for this URL in the selected window.</p>
                                  )}
                                  {(queriesCache[row.url] ?? []).length > 0 && (
                                    <table className="w-full text-xs">
                                      <thead><tr className="text-gray-500 text-left"><th className="py-1 pr-4">Query</th><th className="py-1 pr-4 text-right">Clicks</th><th className="py-1 pr-4 text-right">Impr.</th><th className="py-1 text-right">Pos.</th></tr></thead>
                                      <tbody>
                                        {queriesCache[row.url].map((q) => (
                                          <tr key={q.query} className="border-t border-blue-100">
                                            <td className="py-1 pr-4 font-medium text-gray-800">{q.query}</td>
                                            <td className="py-1 pr-4 text-right tabular-nums">{q.clicks}</td>
                                            <td className="py-1 pr-4 text-right tabular-nums">{q.impressions}</td>
                                            <td className="py-1 text-right tabular-nums">{q.position.toFixed(1)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sorted.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">No URLs match this filter.</p>}
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <p>{sorted.length} URLs · page {safePage + 1}/{pageCount} · click headers to sort · Inspect uses URL Inspection API (~2,000/day)</p>
                  <div className="flex gap-2">
                    <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="px-3 py-1 border border-gray-300 rounded-lg bg-white disabled:opacity-40">← Prev</button>
                    <button disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="px-3 py-1 border border-gray-300 rounded-lg bg-white disabled:opacity-40">Next →</button>
                  </div>
                </div>
              </>
            )}

            {tab === "content" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Published</p><p className="text-2xl font-bold text-gray-900">{data.content.publishedCount}</p><p className="text-xs text-gray-400">{data.content.draftCount} drafts</p></div>
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Avg SEO score</p><p className="text-2xl font-bold text-gray-900">{data.content.avgSeoScore != null ? data.content.avgSeoScore.toFixed(0) : "—"}</p></div>
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Thin / stuffing risks</p><p className="text-2xl font-bold text-gray-900">{data.content.thinRiskCount}<span className="text-sm font-normal text-gray-400"> / {data.content.stuffingRiskCount}</span></p></div>
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Missing meta / orphans</p><p className="text-2xl font-bold text-gray-900">{data.content.missingMetaCount}<span className="text-sm font-normal text-gray-400"> / {data.content.orphanCount}</span></p></div>
                </div>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">SEO</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thin risk</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stuffing</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meta / links</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.content.issues.map((a) => (
                          <tr key={a.slug} className="hover:bg-gray-50">
                            <td className="px-4 py-3 max-w-xs">
                              <Link href={`/articles/${a.slug}`} target="_blank" className="text-blue-600 hover:underline font-medium block truncate" title={a.title}>{a.title}</Link>
                              <p className="text-xs text-gray-400">/articles/{a.slug} · {a.status}</p>
                            </td>
                            <td className={`px-4 py-3 text-right font-bold tabular-nums ${(a.seoScore ?? 100) < 50 ? "text-red-600" : (a.seoScore ?? 100) < 75 ? "text-amber-600" : "text-green-600"}`}>{a.seoScore ?? "—"}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{a.thinContentRisk != null ? `${Math.round(a.thinContentRisk * 100)}%` : "—"}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{a.keywordStuffingRisk != null ? `${Math.round(a.keywordStuffingRisk * 100)}%` : "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {a.missingMeta.length > 0 ? <span className="text-amber-700 font-medium">Missing: {a.missingMeta.join(", ")}</span> : <span className="text-green-700">Meta OK</span>}
                              <span className="text-gray-400"> · {a.incomingLinks} in / {a.outgoingLinks} out</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.content.issues.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">No content issues — all published articles score ≥ 75 with complete meta.</p>}
                </div>
              </>
            )}

            {tab === "technical" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Indexed (PASS)</p><p className="text-2xl font-bold text-green-700">{data.technical.indexed}</p></div>
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Partial</p><p className="text-2xl font-bold text-amber-600">{data.technical.partial}</p></div>
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Failing</p><p className="text-2xl font-bold text-red-600">{data.technical.failing}</p></div>
                  <div className="bg-white rounded-lg shadow p-4"><p className="text-sm text-gray-500">Unchecked</p><p className="text-2xl font-bold text-gray-500">{data.technical.unchecked}</p></div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="font-semibold text-gray-900 mb-2">Sitemap</h2>
                    <p className="text-sm text-gray-600">URLs: <span className="font-bold text-gray-900">{data.technical.sitemap.urlCount ?? "—"}</span> (inventory: {data.technical.inventoryCount})</p>
                    <p className="text-sm text-gray-600">Last modified: {data.technical.sitemap.lastModified ? new Date(data.technical.sitemap.lastModified).toLocaleString("fr-FR") : "not generated yet"}</p>
                    <p className="text-sm text-gray-600">GSC coverage: {data.technical.gscCoverage}/{data.technical.inventoryCount} URLs with data</p>
                    <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">View sitemap.xml →</a>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="font-semibold text-gray-900 mb-2">Meta completeness</h2>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>Articles sans title: <span className="font-bold text-gray-900">{data.technical.metaGaps.articlesMissingTitle}</span></li>
                      <li>Articles sans description: <span className="font-bold text-gray-900">{data.technical.metaGaps.articlesMissingDescription}</span></li>
                      <li>Catalogues sans description: <span className="font-bold text-gray-900">{data.technical.metaGaps.cataloguesMissingDescription}</span></li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-2">Run Inspect per URL for fresh verdicts (quota-limited, on demand only).</p>
                  </div>
                </div>
              </>
            )}

            {tab === "live" && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {[{ h: 24, label: "24h" }, { h: 72, label: "3 jours" }, { h: 168, label: "7 jours" }].map((o) => (
                    <button
                      key={o.h}
                      onClick={() => { setLiveHours(o.h); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${liveHours === o.h ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                  <select
                    value={liveScope}
                    onChange={(e) => setLiveScope(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-full bg-white max-w-72"
                    title="Page scope"
                  >
                    <option value="all">Tout le site</option>
                    {(liveEntry?.top ?? []).map((t) => (
                      <option key={t.path} value={t.path}>{t.path} ({t.views})</option>
                    ))}
                  </select>
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Temps réel · refresh 60s
                  </span>
                </div>

                {liveEntry === undefined && <div className="text-center py-12">Loading live views...</div>}
                {liveEntry === null && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">Couldn&apos;t load live views.</div>
                )}
                {liveEntry && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-500">Vues ({liveHours}h{liveScope !== "all" ? ` · ${liveScope}` : ""})</p>
                        <p className="text-2xl font-bold text-gray-900">{liveEntry.total.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-500">Dernière heure</p>
                        <p className="text-2xl font-bold text-gray-900">{(liveEntry.hours[liveEntry.hours.length - 1]?.views ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-500">Pic horaire</p>
                        <p className="text-2xl font-bold text-gray-900">{Math.max(...liveEntry.hours.map((h) => h.views), 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-[2fr_1fr] gap-4">
                      <div className="bg-white rounded-lg shadow p-4">
                        <h2 className="font-semibold text-gray-900 mb-2">Vues par heure</h2>
                        {liveEntry.total === 0 ? (
                          <p className="text-sm text-gray-500">Aucune vue enregistrée pour cette période — le compteur démarre à l&apos;installation du beacon (données prospectives uniquement).</p>
                        ) : (
                          <LiveChart buckets={liveEntry.hours} />
                        )}
                      </div>
                      <div className="bg-white rounded-lg shadow p-4">
                        <h2 className="font-semibold text-gray-900 mb-2">Top pages</h2>
                        {liveEntry.top.length === 0 && <p className="text-sm text-gray-500">—</p>}
                        <ul className="space-y-1.5 text-sm">
                          {liveEntry.top.map((t) => (
                            <li key={t.path}>
                              <button onClick={() => setLiveScope(t.path)} className="text-blue-600 hover:underline font-medium break-all text-left" title={t.path}>
                                {t.path}
                              </button>
                              <span className="text-gray-400 text-xs ml-2 tabular-nums">{t.views}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">First-party beacon (navigateurs réels, DNT respecté, /admin exclu) — rien à voir avec le décalage de 2 jours de Search Console.</p>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
