import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import { syncPerformance } from "@/services/seo-performance";

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const daysRaw = (body as { days?: unknown }).days;
    const days =
      typeof daysRaw === "number" && daysRaw >= 7 && daysRaw <= 365 ? Math.floor(daysRaw) : 28;
    const result = await syncPerformance(days);
    return NextResponse.json({
      success: true,
      ...result,
      windowStart: result.windowStart.toISOString(),
      windowEnd: result.windowEnd.toISOString(),
    });
  } catch (error) {
    console.error("Error syncing Search Console:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Search Console" },
      { status: 500 }
    );
  }
}
