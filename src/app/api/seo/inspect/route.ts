import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/require-admin";
import { inspectAndStore } from "@/services/seo-performance";

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const { url } = body as { url?: string };
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json({ error: "Valid url required" }, { status: 400 });
    }
    const result = await inspectAndStore(url);
    return NextResponse.json({ success: true, url, ...result });
  } catch (error) {
    console.error("Error inspecting URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to inspect URL" },
      { status: 500 }
    );
  }
}
