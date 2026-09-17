import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import { queryTopQueries } from "@/services/search-console";

const ALLOWED_DAYS = [7, 28, 90, 180, 365];

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const raw = parseInt(params.get("days") || "28", 10);
    const days = ALLOWED_DAYS.includes(raw) ? raw : 28;
    const url = params.get("url") || undefined;
    const limit = Math.min(Math.max(parseInt(params.get("limit") || "20", 10) || 20, 1), 50);
    return NextResponse.json(await queryTopQueries(days, url, limit));
  } catch (error) {
    console.error("Error fetching top queries:", error);
    return NextResponse.json({ error: "Failed to fetch top queries" }, { status: 500 });
  }
}
