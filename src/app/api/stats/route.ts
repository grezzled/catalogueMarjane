import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
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
    ]);

    return NextResponse.json({
      catalogues: stats[0],
      pagesProcessed: stats[1],
      productsExtracted: stats[2],
      offersExtracted: stats[3],
      articlesGenerated: stats[4],
      articlesPublished: stats[5],
      articlesAwaitingReview: stats[6],
      aiErrors: stats[7],
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
