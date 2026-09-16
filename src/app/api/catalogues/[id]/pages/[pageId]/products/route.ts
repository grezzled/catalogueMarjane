import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { pageId } = await params;

    const page = await prisma.cataloguePage.findUnique({
      where: { id: pageId },
      select: { aiAnalysis: true, imagePath: true },
    });

    let boundingBoxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
    if (page?.aiAnalysis) {
      try {
        const analysis = JSON.parse(page.aiAnalysis);
        if (analysis.products) {
          for (const p of analysis.products) {
            if (p.boundingBox && p.name) {
              boundingBoxes[p.name.toLowerCase()] = p.boundingBox;
            }
          }
        }
      } catch {}
    }

    const offers = await prisma.offer.findMany({
      where: { cataloguePageId: pageId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            imageUrl: true,
          },
        },
      },
    });

    const seen = new Set<string>();
    const products = offers
      .map((o) => {
        const p = o.product;
        if (seen.has(p.id)) return null;
        seen.add(p.id);
        return {
          ...p,
          boundingBox: boundingBoxes[p.name.toLowerCase()] || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching page products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
