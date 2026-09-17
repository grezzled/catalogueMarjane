import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import { getHistory } from "@/services/seo-performance";

export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const url = params.get("url") || undefined;
    return NextResponse.json({ history: await getHistory(url) });
  } catch (error) {
    console.error("Error fetching SEO history:", error);
    return NextResponse.json({ error: "Failed to fetch SEO history" }, { status: 500 });
  }
}
