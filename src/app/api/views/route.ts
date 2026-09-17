import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";

const BOT_RE = /bot|crawl|spider|slurp|mediapartners|baidu|yandex|semrush|ahrefs|mj12|dotbot|petal|gptbot|ccbot|anthropic|claude/i;

/** Beacon receiver (public). Stores pathname-only views from real browsers. */
export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (BOT_RE.test(ua)) return new NextResponse(null, { status: 204 });
    const body = await request.json().catch(() => null);
    const path = typeof body?.path === "string" ? body.path : "";
    if (
      !path.startsWith("/") ||
      path.length > 200 ||
      path.startsWith("//") ||
      path.startsWith("/api") ||
      path.startsWith("/admin")
    ) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    await prisma.pageView.create({ data: { path } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error recording page view:", error);
    return new NextResponse(null, { status: 204 });
  }
}

/** Hourly buckets + top paths (admin). `?hours=24&path=/…` */
export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const rawHours = parseInt(params.get("hours") || "24", 10);
    const hours = Math.min(Math.max(Number.isFinite(rawHours) ? rawHours : 24, 1), 168);
    const path = params.get("path") || undefined;

    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600 * 1000);
    start.setMinutes(0, 0, 0);

    const rows = await prisma.pageView.findMany({
      where: { createdAt: { gte: start }, ...(path ? { path } : {}) },
      select: { path: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const buckets: { hour: string; views: number }[] = [];
    const idx = new Map<string, number>();
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 3600 * 1000)) {
      const h = new Date(d);
      h.setMinutes(0, 0, 0);
      idx.set(h.toISOString(), buckets.length);
      buckets.push({ hour: h.toISOString(), views: 0 });
    }
    const perPath = new Map<string, number>();
    for (const r of rows) {
      const h = new Date(r.createdAt);
      h.setMinutes(0, 0, 0);
      const i = idx.get(h.toISOString());
      if (i !== undefined) buckets[i].views += 1;
      perPath.set(r.path, (perPath.get(r.path) ?? 0) + 1);
    }
    const top = [...perPath.entries()]
      .map(([p, views]) => ({ path: p, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    return NextResponse.json({ hours: buckets, total: rows.length, top });
  } catch (error) {
    console.error("Error fetching page views:", error);
    return NextResponse.json({ error: "Failed to fetch page views" }, { status: 500 });
  }
}
