import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { hasOriginals } from "@/services/originals";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const stats = await Promise.all([
      prisma.catalogue.count(),
      prisma.cataloguePage.count(),
      prisma.product.count(),
      prisma.offer.count(),
      prisma.article.count(),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      prisma.article.count({ where: { status: "REVIEW" } }),
      prisma.aIJob.count({ where: { status: "FAILED" } }),
      prisma.product.count({ where: { imageUrl: null } }),
      prisma.cataloguePage.findMany({
        where: { aiAnalysis: { not: null } },
        select: { id: true, aiAnalysis: true },
      }),
    ]);

    // Detections without bounding boxes: products the AI listed but gave no
    // crop area for. Only a re-analysis (new mandatory-box prompt) can fix these.
    let productsWithoutBoxes = 0;
    const pagesWithoutBoxes = new Set<string>();
    for (const page of stats[9] as Array<{ id: string; aiAnalysis: string | null }>) {
      try {
        const products = (JSON.parse(page.aiAnalysis as string) as {
          products?: Array<{ name?: string; boundingBox?: unknown }>;
        }).products ?? [];
        for (const product of products) {
          if (!product?.boundingBox) {
            productsWithoutBoxes++;
            pagesWithoutBoxes.add(page.id);
          }
        }
      } catch {
        // Unreadable analysis — backfill reports it separately.
      }
    }

    // Catalogues whose 200-DPI originals are missing (AI falls back to WebP).
    const catalogueIds = await prisma.catalogue.findMany({ select: { id: true } });
    let cataloguesMissingOriginals = 0;
    for (const c of catalogueIds) {
      if (!(await hasOriginals(c.id))) cataloguesMissingOriginals++;
    }

    return NextResponse.json({
      catalogues: stats[0],
      pagesProcessed: stats[1],
      productsExtracted: stats[2],
      offersExtracted: stats[3],
      articlesGenerated: stats[4],
      articlesPublished: stats[5],
      articlesAwaitingReview: stats[6],
      aiErrors: stats[7],
      productsMissingImages: stats[8],
      productsWithoutBoxes,
      pagesWithoutBoxes: pagesWithoutBoxes.size,
      cataloguesMissingOriginals,
      cataloguesTotal: catalogueIds.length,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
