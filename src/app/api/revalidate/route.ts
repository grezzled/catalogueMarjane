import { NextRequest, NextResponse } from "next/server";
import { revalidateArticle, revalidateCatalogue, revalidateSite } from "@/lib/revalidate";

/**
 * On-demand revalidation, called by the admin when background jobs complete
 * (the worker itself cannot call revalidatePath outside a request scope).
 * Admin-only via middleware.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scope, slug } = body as { scope?: string; slug?: string };

    if (scope === "catalogue" && slug) {
      revalidateCatalogue(slug);
      return NextResponse.json({ success: true, scope, slug });
    }
    if (scope === "article" && slug) {
      revalidateArticle(slug);
      return NextResponse.json({ success: true, scope, slug });
    }
    if (scope === "site" || scope === undefined) {
      revalidateSite();
      return NextResponse.json({ success: true, scope: "site" });
    }
    return NextResponse.json({ error: "Invalid scope or missing slug" }, { status: 400 });
  } catch (error) {
    console.error("Revalidate error:", error);
    return NextResponse.json({ error: "Failed to revalidate" }, { status: 500 });
  }
}
