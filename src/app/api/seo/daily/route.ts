import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import { queryDailyPerformance } from "@/services/search-console";

/** Per-day GSC totals (actual day values, not window aggregates). */
export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const raw = parseInt(params.get("days") || "28", 10);
    const days = Math.min(Math.max(Number.isFinite(raw) ? raw : 28, 1), 180);
    const url = params.get("url") || undefined;
    const { days: rows } = await queryDailyPerformance(days, url);

    // GSC omits zero-traffic days — fill them so the chart shows real gaps.
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const filled = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = fmt(d);
      filled.push(byDate.get(key) ?? { date: key, clicks: 0, impressions: 0, ctr: 0, position: 0 });
    }
    return NextResponse.json({ days: filled });
  } catch (error) {
    console.error("Error fetching daily performance:", error);
    return NextResponse.json({ error: "Failed to fetch daily performance" }, { status: 500 });
  }
}
