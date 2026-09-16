import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import { getPerformanceDashboard } from "@/services/seo-performance";

const ALLOWED_DAYS = [7, 28, 90, 180, 365];

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const raw = parseInt(new URL(request.url).searchParams.get("days") || "28", 10);
    const days = ALLOWED_DAYS.includes(raw) ? raw : 28;
    return NextResponse.json(await getPerformanceDashboard(days));
  } catch (error) {
    console.error("Error building SEO dashboard:", error);
    return NextResponse.json(
      { error: "Failed to build SEO dashboard" },
      { status: 500 }
    );
  }
}
