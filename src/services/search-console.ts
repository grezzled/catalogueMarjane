import { google } from "googleapis";
import fs from "fs/promises";

export interface GscSetup {
  configured: boolean;
  property: string | null;
  error: string | null;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscInspectResult {
  verdict: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
}

function getProperty(): string | null {
  const raw =
    process.env.GSC_PROPERTY || process.env.NEXT_PUBLIC_APP_URL || null;
  if (!raw) return null;
  // Domain properties pass through untouched; URL properties need a trailing slash.
  if (raw.startsWith("sc-domain:")) return raw;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return null;
  }
}

async function loadCredentials(): Promise<Record<string, unknown> | null> {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getGscSetup(): Promise<GscSetup> {
  const property = getProperty();
  if (!property) {
    return {
      configured: false,
      property: null,
      error: "Set GSC_PROPERTY (e.g. https://cataloguemarjane.com/) or NEXT_PUBLIC_APP_URL.",
    };
  }
  const credentials = await loadCredentials();
  if (!credentials) {
    return {
      configured: false,
      property,
      error:
        "Set GOOGLE_SERVICE_ACCOUNT_JSON (service account key JSON) or GOOGLE_SERVICE_ACCOUNT_FILE, and grant it access to the Search Console property.",
    };
  }
  return { configured: true, property, error: null };
}

async function getClient() {
  const setup = await getGscSetup();
  if (!setup.configured || !setup.property) {
    throw new Error(setup.error || "Search Console is not configured");
  }
  const credentials = (await loadCredentials()) as Record<string, string>;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  });
  return {
    property: setup.property,
    searchconsole: google.searchconsole({ version: "v1", auth }),
  };
}

/** Per-page totals for the last `days` days (max 5000 rows). */
export async function queryPerformance(days = 28): Promise<{ property: string; rows: GscPageRow[] }> {
  const { property, searchconsole } = await getClient();
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data lags ~1-2 days
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const rows: GscPageRow[] = [];
  let startRow = 0;
  for (;;) {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: property,
      requestBody: {
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ["page"],
        rowLimit: 1000,
        startRow,
      },
    });
    const batch = res.data.rows ?? [];
    for (const r of batch) {
      rows.push({
        page: r.keys?.[0] ?? "",
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
    }
    if (batch.length < 1000 || rows.length >= 5000) break;
    startRow += batch.length;
  }

  return { property, rows };
}

export interface GscQueryRow {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
/** Top search queries, optionally filtered to one page (dimensions page+query). */
export async function queryTopQueries(
  days = 28,
  pageUrl?: string,
  limit = 20
): Promise<{ property: string; rows: GscQueryRow[] }> {
  const { property, searchconsole } = await getClient();
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data lags ~1-2 days
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await searchconsole.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["page", "query"],
      ...(pageUrl ? { dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }] } : {}),
      rowLimit: Math.min(Math.max(limit, 1), 1000),
    },
  });
  const rows: GscQueryRow[] = (res.data.rows ?? []).map((r) => ({
    page: r.keys?.[0] ?? "",
    query: r.keys?.[1] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
  rows.sort((a, b) => b.impressions - a.impressions);
  return { property, rows };
}

export interface GscDayRow {
  /** YYYY-MM-DD */
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Per-day totals for the last `days` days, optionally for one page. */
export async function queryDailyPerformance(
  days = 28,
  pageUrl?: string
): Promise<{ property: string; days: GscDayRow[] }> {
  const { property, searchconsole } = await getClient();
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data lags ~1-2 days
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const usePage = !!pageUrl;

  const res = await searchconsole.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: usePage ? ["date", "page"] : ["date"],
      ...(usePage
        ? { dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl as string }] }] }
        : {}),
      rowLimit: 1000,
    },
  });
  const rows: GscDayRow[] = (res.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { property, days: rows };
}

/** On-demand URL Inspection (quota-limited: ~2000/day). */
export async function inspectUrl(url: string): Promise<GscInspectResult> {
  const { property, searchconsole } = await getClient();
  const siteUrl = property.startsWith("sc-domain:")
    ? undefined
    : property;
  const res = await searchconsole.urlInspection.index.inspect({
    requestBody: {
      inspectionUrl: url,
      ...(siteUrl ? { siteUrl } : {}),
    },
  });
  const result = res.data.inspectionResult;
  return {
    verdict: result?.indexStatusResult?.verdict ?? "UNKNOWN",
    coverageState: result?.indexStatusResult?.coverageState ?? undefined,
    robotsTxtState: result?.indexStatusResult?.robotsTxtState ?? undefined,
    indexingState: result?.indexStatusResult?.indexingState ?? undefined,
    lastCrawlTime: result?.indexStatusResult?.lastCrawlTime ?? undefined,
    pageFetchState: result?.indexStatusResult?.pageFetchState ?? undefined,
  };
}
