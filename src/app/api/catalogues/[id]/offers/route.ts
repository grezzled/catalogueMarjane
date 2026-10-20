import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    const { id } = await params;
    const offers = await prisma.offer.findMany({
      where: { catalogueId: id },
      orderBy: [{ discountPercentage: "desc" }, { salePrice: "asc" }],
      select: {
        id: true,
        productId: true,
        salePrice: true,
        originalPrice: true,
        discountPercentage: true,
        discountAmount: true,
        product: {
          select: {
            name: true,
            slug: true,
            category: true,
            imageUrl: true,
          },
        },
        cataloguePage: { select: { pageNumber: true } },
      },
    });
    return NextResponse.json(offers);
  } catch (error) {
    console.error("Error fetching catalogue offers:", error);
    return NextResponse.json(
      { error: "Impossible de charger les offres du catalogue." },
      { status: 500 }
    );
  }
}
