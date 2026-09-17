import prisma from "@/lib/prisma";
import { stat } from "fs/promises";
import { join } from "path";
import { getGscSetup, inspectUrl, queryPerformance } from "@/services/search-console";

export interface InventoryUrl {
  url: string;
  kind: "home" | "catalogues" | "catalogue" | "promotions" | "articles" | "article" | "category";
  title?: string;
}

export interface Insight {
  type: "no-impressions" | "low-ctr" | "striking-distance" | "not-indexed";
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface PerformanceRow extends InventoryUrl {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  hasData: boolean;
  indexVerdict: string | null;
  inspectedAt: string | null;
  insights: Insight[];
}

export const INSIGHT_THRESHOLDS = {
  /** Impressions above which a <2% CTR is a problem. */
  lowCtrImpressions: 100,
  lowCtrRate: 0.02,
  /** "Striking distance" position band. */
  strikingFrom: 8,
  strikingTo: 20,
  strikingImpressions: 50,
};

function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://cataloguemarjane.com";
  return raw.replace(/\/+$/, "");
}

function joinUrl(path: string): string {
  return `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Every public URL worth tracking — joined against GSC data on display. */
export async function buildUrlInventory(): Promise<InventoryUrl[]> {
  // NOTE: no per-page catalogue URLs — standalone /page/N routes are gone
  // (301 → catalogue anchor) and fragment URLs are meaningless to inspect.
  const [catalogues, articles, categories] = await Promise.all([
    prisma.catalogue.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, title: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, title: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.category.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const inventory: InventoryUrl[] = [
    { url: joinUrl("/"), kind: "home", title: "Accueil" },
    { url: joinUrl("/catalogue-marjane"), kind: "catalogues", title: "Catalogues" },
    { url: joinUrl("/promotions-marjane"), kind: "promotions", title: "Promotions" },
    { url: joinUrl("/articles"), kind: "articles", title: "Articles" },
  ];
  for (const c of catalogues) {
    inventory.push({
      url: joinUrl(`/catalogue-marjane/${c.slug}`),
      kind: "catalogue",
      title: c.title,
    });
  }
  for (const a of articles) {
    inventory.push({
      url: joinUrl(`/articles/${a.slug}`),
      kind: "article",
      title: a.title,
    });
  }
  for (const c of categories) {
    inventory.push({
      url: joinUrl(`/category/${c.slug}`),
      kind: "category",
      title: c.name,
    });
  }
  return inventory;
}

function insightsFor(row: {
  impressions: number;
  ctr: number;
  position: number | null;
  hasData: boolean;
  indexVerdict: string | null;
}): Insight[] {
  const insights: Insight[] = [];
  if (!row.hasData || row.impressions === 0) {
    insights.push({
      type: "no-impressions",
      severity: "info",
      message: "Zero impressions — wrong search intent, weak page, or not indexed yet.",
    });
    return insights;
  }
  if (
    row.impressions >= INSIGHT_THRESHOLDS.lowCtrImpressions &&
    row.ctr < INSIGHT_THRESHOLDS.lowCtrRate
  ) {
    insights.push({
      type: "low-ctr",
      severity: "warning",
      message: `High impressions but ${(row.ctr * 100).toFixed(1)}% CTR — improve title/meta.`,
    });
  }
  if (
    row.position != null &&
    row.position >= INSIGHT_THRESHOLDS.strikingFrom &&
    row.position <= INSIGHT_THRESHOLDS.strikingTo &&
    row.impressions >= INSIGHT_THRESHOLDS.strikingImpressions
  ) {
    insights.push({
      type: "striking-distance",
      severity: "warning",
      message: `Position ${row.position.toFixed(1)} (page 1-2 edge) — improve content & internal links.`,
    });
  }
  if (
    row.indexVerdict &&
    !["PASS", "VERDICT_UNSPECIFIED"].includes(row.indexVerdict) &&
    row.impressions === 0
  ) {
    insights.push({
      type: "not-indexed",
      severity: "critical",
      message: `Index verdict ${row.indexVerdict} with zero impressions — inspect page quality.`,
    });
  }
  return insights;
}

/** Pull GSC performance and snapshot it; returns the fresh window. */
export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function spanDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** Calendar-day key — groups snapshots synced minutes apart for the same logical window. */
export function endDayKey(end: Date, span: number): string {
  return `${end.getFullYear()}-${end.getMonth() + 1}-${end.getDate()}|${span}`;
}

type SnapshotRow = {
  url: string;
  windowStart: Date;
  windowEnd: Date;
  clicks: number;
  impressions: number;
  position: number | null;
};

/**
 * Dedupe snapshots to one row per (URL, calendar day, span).
 * Prefers the row with the most impressions (a zero-impression inspect
 * placeholder must never shadow real synced data); ties → latest sync.
 */
export function dedupeSnapshots<T extends SnapshotRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const key = `${r.url}|${endDayKey(r.windowEnd, spanDays(r.windowStart, r.windowEnd))}`;
    const prev = best.get(key);
    if (
      !prev ||
      r.impressions > prev.impressions ||
      (r.impressions === prev.impressions && r.clicks > prev.clicks) ||
      (r.impressions === prev.impressions && r.clicks === prev.clicks && r.windowEnd > prev.windowEnd)
    ) {
      best.set(key, r);
    }
  }
  return [...best.values()];
}

export async function syncPerformance(days = 28): Promise<{
  property: string;
  windowStart: Date;
  windowEnd: Date;
  rows: number;
  urls: number;
}> {
  const setup = await getGscSetup();
  if (!setup.configured) throw new Error(setup.error || "Search Console is not configured");

  const { rows } = await queryPerformance(days);
  // Day boundaries (not now-ms): re-syncing the same logical window upserts
  // the same rows instead of creating near-duplicate windows minutes apart.
  const end = startOfDay(new Date());
  end.setDate(end.getDate() - 1);
  const start = startOfDay(end);
  start.setDate(start.getDate() - (days - 1));
  const byUrl = new Map(rows.map((r) => [r.page, r]));

  // Upsert one row per URL for this window.
  for (const row of rows) {
    await prisma.searchConsoleRow.upsert({
      where: {
        url_windowStart_windowEnd: { url: row.page, windowStart: start, windowEnd: end },
      },
      create: {
        url: row.page,
        windowStart: start,
        windowEnd: end,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
      update: {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
    });
  }

  // Keep only the 8 most recent calendar-day windows (several spans can
  // coexist). Day-based: same-day re-syncs must not evict real history.
  const distinctEnds = await prisma.searchConsoleRow.findMany({
    select: { windowStart: true, windowEnd: true },
    distinct: ["windowEnd"],
    orderBy: { windowEnd: "desc" },
    take: 200,
  });
  const keepDays = new Set<string>();
  for (const w of distinctEnds) {
    if (keepDays.size >= 8) break;
    keepDays.add(endDayKey(w.windowEnd, spanDays(w.windowStart, w.windowEnd)));
  }
  const drop = distinctEnds
    .filter((w) => !keepDays.has(endDayKey(w.windowEnd, spanDays(w.windowStart, w.windowEnd))))
    .map((w) => w.windowEnd);
  if (drop.length > 0) {
    await prisma.searchConsoleRow.deleteMany({ where: { windowEnd: { in: drop } } });
  }

  return { property: setup.property as string, windowStart: start, windowEnd: end, rows: rows.length, urls: byUrl.size };
}

export interface HistoryPoint {
  windowEnd: string;
  days: number;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number | null;
}

export interface ContentIssue {
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

export interface DashboardContent {
  publishedCount: number;
  draftCount: number;
  avgSeoScore: number | null;
  thinRiskCount: number;
  stuffingRiskCount: number;
  missingMetaCount: number;
  orphanCount: number;
  issues: ContentIssue[];
}

export interface DashboardTechnical {
  indexed: number;
  partial: number;
  failing: number;
  unchecked: number;
  inventoryCount: number;
  gscCoverage: number;
  sitemap: { urlCount: number | null; lastModified: string | null };
  metaGaps: { articlesMissingTitle: number; articlesMissingDescription: number; cataloguesMissingDescription: number };
}

/** Latest snapshot joined against the live URL inventory, with insights. */
export async function getPerformanceDashboard(
  days = 28
): Promise<{
  setup: { configured: boolean; error: string | null };
  window: { windowStart: string; windowEnd: string; days: number } | null;
  rows: PerformanceRow[];
  history: HistoryPoint[];
  delta: { clicks: number; impressions: number; ctr: number; avgPosition: number | null } | null;
  avgPosition: number | null;
  content: DashboardContent;
  technical: DashboardTechnical;
}> {
  const setup = await getGscSetup();
  const inventory = await buildUrlInventory();
  const inventorySet = new Set(inventory.map((i) => i.url));

  // Latest calendar-day window whose span matches the requested days.
  // Day-based (not exact-ms): same-day re-syncs collapse into one window.
  const windows = await prisma.searchConsoleRow.findMany({
    select: { windowStart: true, windowEnd: true },
    distinct: ["windowEnd"],
    orderBy: { windowEnd: "desc" },
    take: 200,
  });
  const dayWindows = new Map<string, { windowStart: Date; windowEnd: Date }>();
  for (const w of windows) {
    if (spanDays(w.windowStart, w.windowEnd) !== days) continue;
    const key = endDayKey(w.windowEnd, days);
    if (!dayWindows.has(key)) dayWindows.set(key, w); // desc → latest sync wins
  }
  const sameSpanDays = [...dayWindows.values()];
  const match = sameSpanDays[0] ?? null;
  const prev = sameSpanDays[1] ?? null;

  /** Snapshot rows for a calendar-day window: same span, inventory URLs, one row per URL. */
  async function snapshotFor(day: { windowStart: Date; windowEnd: Date }) {
    const from = startOfDay(day.windowEnd);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const rows = await prisma.searchConsoleRow.findMany({
      where: { windowEnd: { gte: from, lt: to } },
    });
    return dedupeSnapshots(
      rows.filter((r) => spanDays(r.windowStart, r.windowEnd) === days && inventorySet.has(r.url))
    );
  }

  const snapshot = match ? await snapshotFor(match) : [];
  const byUrl = new Map(snapshot.map((r) => [r.url, r]));

  const rows: PerformanceRow[] = inventory.map((item) => {
    const data = byUrl.get(item.url);
    const hasData = !!data && data.impressions > 0;
    const base = {
      ...item,
      clicks: data?.clicks ?? 0,
      impressions: data?.impressions ?? 0,
      ctr: data?.ctr ?? 0,
      position: data ? data.position : null,
      hasData,
      indexVerdict: data?.indexVerdict ?? null,
      inspectedAt: data?.inspectedAt ? data.inspectedAt.toISOString() : null,
    };
    return { ...base, insights: insightsFor(base) };
  });

  // Most opportunity first: critical → warnings → by impressions desc.
  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  rows.sort((a, b) => {
    const sa = a.insights.length ? Math.min(...a.insights.map((i) => severityRank[i.severity])) : 3;
    const sb = b.insights.length ? Math.min(...b.insights.map((i) => severityRank[i.severity])) : 3;
    if (sa !== sb) return sa - sb;
    return b.impressions - a.impressions;
  });

  // ---- Trends: aggregate every stored window for the chart + deltas ----
  // Inventory-filtered so stale GSC-only URLs (removed /page/N routes…)
  // don't inflate sitewide totals; day-deduped so re-syncs don't double-count.
  const allSnapshots = await prisma.searchConsoleRow.findMany({
    select: { url: true, windowStart: true, windowEnd: true, clicks: true, impressions: true, ctr: true, position: true },
  });
  const history = aggregateHistory(allSnapshots, inventorySet);

  // Weighted avg position for the current window + delta vs previous same-span window.
  const posRows = snapshot.filter((s) => s.position != null && s.impressions > 0);
  const posWeight = posRows.reduce((s, r) => s + r.impressions, 0);
  const avgPosition = posWeight > 0 ? posRows.reduce((s, r) => s + (r.position as number) * r.impressions, 0) / posWeight : null;

  let delta: { clicks: number; impressions: number; ctr: number; avgPosition: number | null } | null = null;
  if (prev && match) {
    const prevRows = await snapshotFor(prev);
    const pc = prevRows.reduce((s, r) => s + r.clicks, 0);
    const pi = prevRows.reduce((s, r) => s + r.impressions, 0);
    const cc = snapshot.reduce((s, r) => s + r.clicks, 0);
    const ci = snapshot.reduce((s, r) => s + r.impressions, 0);
    const pPos = prevRows.filter((r) => r.position != null && r.impressions > 0);
    const pW = pPos.reduce((s, r) => s + r.impressions, 0);
    const pAvg = pW > 0 ? pPos.reduce((s, r) => s + (r.position as number) * r.impressions, 0) / pW : null;
    delta = {
      clicks: cc - pc,
      impressions: ci - pi,
      ctr: (ci > 0 ? cc / ci : 0) - (pi > 0 ? pc / pi : 0),
      avgPosition: avgPosition != null && pAvg != null ? avgPosition - pAvg : null,
    };
  }

  // ---- Content quality: article scores, meta gaps, linking orphans ----
  const articles = await prisma.article.findMany({
    select: {
      slug: true, title: true, status: true, seoScore: true,
      thinContentRisk: true, keywordStuffingRisk: true,
      metaTitle: true, metaDescription: true,
    },
  });
  const links = await prisma.articleLink.groupBy({ by: ["targetArticleId"], _count: { targetArticleId: true } });
  const incoming = new Map(links.map((l) => [l.targetArticleId, l._count.targetArticleId]));
  const idBySlug = new Map((await prisma.article.findMany({ select: { id: true, slug: true } })).map((a) => [a.slug, a.id]));
  const outgoingCounts = await prisma.articleLink.groupBy({ by: ["sourceArticleId"], _count: { sourceArticleId: true } });
  const outgoing = new Map(outgoingCounts.map((l) => [l.sourceArticleId, l._count.sourceArticleId]));
  // Risks are stored 0-100 (see AI prompt + zod schema); normalise to 0-1 ratios.
  const riskRatio = (v: number | null): number | null => (v == null ? null : v > 1 ? v / 100 : v);
  const isRisky = (v: number | null): boolean => (v == null ? false : v > 1 ? v > 50 : v > 0.5);
  const issues: ContentIssue[] = articles
    .map((a) => {
      const missingMeta: string[] = [];
      if (!a.metaTitle) missingMeta.push("title");
      if (!a.metaDescription) missingMeta.push("description");
      const id = idBySlug.get(a.slug);
      return {
        slug: a.slug, title: a.title, status: a.status,
        seoScore: a.seoScore, thinContentRisk: riskRatio(a.thinContentRisk),
        keywordStuffingRisk: riskRatio(a.keywordStuffingRisk), missingMeta,
        incomingLinks: id ? (incoming.get(id) ?? 0) : 0,
        outgoingLinks: id ? (outgoing.get(id) ?? 0) : 0,
      };
    })
    .filter((a) => a.status === "PUBLISHED" && (a.seoScore == null || a.seoScore < 75 || (a.thinContentRisk ?? 0) > 0.5 || (a.keywordStuffingRisk ?? 0) > 0.5 || a.missingMeta.length > 0 || a.incomingLinks === 0))
    .sort((a, b) => (a.seoScore ?? 0) - (b.seoScore ?? 0))
    .slice(0, 50);
  const published = articles.filter((a) => a.status === "PUBLISHED");
  const scored = published.filter((a) => a.seoScore != null);
  const content: DashboardContent = {
    publishedCount: published.length,
    draftCount: articles.filter((a) => a.status !== "PUBLISHED").length,
    avgSeoScore: scored.length > 0 ? scored.reduce((s, a) => s + (a.seoScore as number), 0) / scored.length : null,
    thinRiskCount: published.filter((a) => isRisky(a.thinContentRisk)).length,
    stuffingRiskCount: published.filter((a) => isRisky(a.keywordStuffingRisk)).length,
    missingMetaCount: published.filter((a) => !a.metaTitle || !a.metaDescription).length,
    orphanCount: issues.filter((a) => a.incomingLinks === 0).length,
    issues,
  };

  // ---- Technical: index verdicts, sitemap, meta completeness ----
  let indexed = 0, partial = 0, failing = 0;
  for (const r of snapshot) {
    if (r.indexVerdict === "PASS") indexed++;
    else if (r.indexVerdict === "PARTIAL") partial++;
    else if (r.indexVerdict) failing++;
  }
  const gscUrls = new Set(snapshot.map((s) => s.url));
  const gscCoverage = inventory.filter((i) => gscUrls.has(i.url)).length;
  let sitemap: DashboardTechnical["sitemap"] = { urlCount: null, lastModified: null };
  try {
    const p = join(process.cwd(), "public", "sitemap.xml");
    const s = await stat(p);
    const { readFile } = await import("fs/promises");
    const xml = await readFile(p, "utf8");
    sitemap = { urlCount: (xml.match(/<loc>/g) ?? []).length, lastModified: s.mtime.toISOString() };
  } catch { /* sitemap not generated yet */ }
  const [articlesMissingTitle, articlesMissingDescription, cataloguesMissingDescription] = await Promise.all([
    prisma.article.count({ where: { status: "PUBLISHED", OR: [{ metaTitle: null }, { metaTitle: "" }] } }),
    prisma.article.count({ where: { status: "PUBLISHED", OR: [{ metaDescription: null }, { metaDescription: "" }] } }),
    prisma.catalogue.count({ where: { status: "PUBLISHED", OR: [{ description: null }, { description: "" }] } }),
  ]);
  const technical: DashboardTechnical = {
    indexed, partial, failing,
    unchecked: snapshot.length - indexed - partial - failing,
    inventoryCount: inventory.length,
    gscCoverage,
    sitemap,
    metaGaps: { articlesMissingTitle, articlesMissingDescription, cataloguesMissingDescription },
  };

  return {
    setup: { configured: setup.configured, error: setup.error },
    window: match
      ? (() => {
          // Display day boundaries (the stored rows may predate
          // day-normalisation and carry sync-time hours/minutes).
          const displayEnd = startOfDay(match.windowEnd);
          const displayStart = startOfDay(displayEnd);
          displayStart.setDate(displayStart.getDate() - (days - 1));
          return {
            windowStart: displayStart.toISOString(),
            windowEnd: displayEnd.toISOString(),
            days,
          };
        })()
      : null,
    rows,
    history,
    delta,
    avgPosition,
    content,
    technical,
  };
}

/**
 * Aggregate raw snapshot rows into per-window history points.
 * - Same-day re-sync duplicates are merged (keeps latest per URL/day/span).
 * - Optionally restricted to inventory URLs so stale GSC-only URLs
 *   (e.g. removed /page/N routes) don't inflate sitewide totals.
 */
export function aggregateHistory(
  snapshots: SnapshotRow[],
  inventory?: Set<string>
): HistoryPoint[] {
  const deduped = dedupeSnapshots(inventory ? snapshots.filter((s) => inventory.has(s.url)) : snapshots);
  const byWindow = new Map<string, { end: Date; days: number; clicks: number; impressions: number; posSum: number; posWeight: number }>();
  for (const s of deduped) {
    const days = spanDays(s.windowStart, s.windowEnd);
    const key = endDayKey(s.windowEnd, days);
    let agg = byWindow.get(key);
    if (!agg) {
      agg = { end: s.windowEnd, days, clicks: 0, impressions: 0, posSum: 0, posWeight: 0 };
      byWindow.set(key, agg);
    }
    agg.clicks += s.clicks;
    agg.impressions += s.impressions;
    if (s.position != null && s.impressions > 0) {
      agg.posSum += s.position * s.impressions;
      agg.posWeight += s.impressions;
    }
  }
  return [...byWindow.values()]
    .map((w) => ({
      windowEnd: w.end.toISOString(),
      days: w.days,
      clicks: w.clicks,
      impressions: w.impressions,
      ctr: w.impressions > 0 ? w.clicks / w.impressions : 0,
      avgPosition: w.posWeight > 0 ? w.posSum / w.posWeight : null,
    }))
    .sort((a, b) => +new Date(a.windowEnd) - +new Date(b.windowEnd));
}

/** History for one URL (one row per window), or sitewide aggregate when omitted. */
export async function getHistory(url?: string): Promise<HistoryPoint[]> {
  if (url) {
    const snapshots = await prisma.searchConsoleRow.findMany({
      where: { url },
      select: { url: true, windowStart: true, windowEnd: true, clicks: true, impressions: true, ctr: true, position: true },
      orderBy: { windowEnd: "asc" },
    });
    return dedupeSnapshots(snapshots).map((s) => ({
      windowEnd: s.windowEnd.toISOString(),
      days: spanDays(s.windowStart, s.windowEnd),
      clicks: s.clicks,
      impressions: s.impressions,
      ctr: s.ctr,
      avgPosition: s.position,
    }));
  }
  const inventory = new Set((await buildUrlInventory()).map((i) => i.url));
  const snapshots = await prisma.searchConsoleRow.findMany({
    select: { url: true, windowStart: true, windowEnd: true, clicks: true, impressions: true, ctr: true, position: true },
    orderBy: { windowEnd: "asc" },
  });
  return aggregateHistory(snapshots, inventory);
}

/** Inspect one URL and persist the verdict onto its latest snapshot row. */
export async function inspectAndStore(url: string): Promise<{
  verdict: string;
  detail?: string;
}> {
  const result = await inspectUrl(url);
  const latest = await prisma.searchConsoleRow.findFirst({
    where: { url },
    orderBy: { windowEnd: "desc" },
  });
  if (latest) {
    await prisma.searchConsoleRow.update({
      where: { id: latest.id },
      data: {
        indexVerdict: result.verdict,
        indexDetail: result.coverageState ?? null,
        inspectedAt: new Date(),
      },
    });
  } else {
    // Day boundaries so the placeholder merges into the current 28d
    // day-window instead of creating yet another near-duplicate window.
    const end = startOfDay(new Date());
    end.setDate(end.getDate() - 1);
    const start = startOfDay(end);
    start.setDate(start.getDate() - 27);
    await prisma.searchConsoleRow.create({
      data: {
        url,
        windowStart: start,
        windowEnd: end,
        indexVerdict: result.verdict,
        indexDetail: result.coverageState ?? null,
        inspectedAt: new Date(),
      },
    });
  }
  return { verdict: result.verdict, detail: result.coverageState };
}
