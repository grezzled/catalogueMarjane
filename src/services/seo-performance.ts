import prisma from "@/lib/prisma";
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
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
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

  // Keep only the 8 most recent windows (several spans can coexist).
  const windows = await prisma.searchConsoleRow.findMany({
    select: { windowEnd: true },
    distinct: ["windowEnd"],
    orderBy: { windowEnd: "desc" },
  });
  const keep = new Set(windows.slice(0, 8).map((w) => w.windowEnd.getTime()));
  const drop = windows.filter((w) => !keep.has(w.windowEnd.getTime())).map((w) => w.windowEnd);
  if (drop.length > 0) {
    await prisma.searchConsoleRow.deleteMany({ where: { windowEnd: { in: drop } } });
  }

  return { property: setup.property as string, windowStart: start, windowEnd: end, rows: rows.length, urls: byUrl.size };
}

/** Latest snapshot joined against the live URL inventory, with insights. */
export async function getPerformanceDashboard(
  days = 28
): Promise<{
  setup: { configured: boolean; error: string | null };
  window: { windowStart: string; windowEnd: string; days: number } | null;
  rows: PerformanceRow[];
}> {
  const setup = await getGscSetup();
  const inventory = await buildUrlInventory();

  // Latest window whose span matches the requested number of days.
  const windows = await prisma.searchConsoleRow.findMany({
    select: { windowStart: true, windowEnd: true },
    distinct: ["windowEnd"],
    orderBy: { windowEnd: "desc" },
  });
  const match = windows.find((w) => {
    const span =
      Math.round((w.windowEnd.getTime() - w.windowStart.getTime()) / 86400000) + 1;
    return span === days;
  });
  const snapshot = match
    ? await prisma.searchConsoleRow.findMany({
        where: { windowEnd: match.windowEnd },
      })
    : [];
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

  return {
    setup: { configured: setup.configured, error: setup.error },
    window: match
      ? {
          windowStart: match.windowStart.toISOString(),
          windowEnd: match.windowEnd.toISOString(),
          days,
        }
      : null,
    rows,
  };
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
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
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
