import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { toPublicImageUrl } from "@/services/products";
import type { ProductResult } from "@/services/products";

export const runtime = "nodejs";

/** Batch product lookup for the shopping list. GET ?slugs=a,b,c (max 100). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slugs = (searchParams.get("slugs") || "")
    .split(",")
    .map((s) => s.trim().slice(0, 120))
    .filter((s) => /^[a-z0-9-]+$/i.test(s))
    .slice(0, 100);
  if (slugs.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const now = new Date();
  const rows = await prisma.product.findMany({
    where: { OR: [{ slug: { in: slugs } }, { id: { in: slugs } }] },
    include: {
      offers: {
        where: { catalogue: { status: "PUBLISHED" } },
        select: {
          salePrice: true,
          originalPrice: true,
          discountPercentage: true,
          startDate: true,
          endDate: true,
          catalogue: { select: { slug: true, title: true, status: true } },
          cataloguePage: { select: { pageNumber: true } },
        },
      },
    },
  });

  const products: ProductResult[] = rows.map((p) => {
    const pubOffers = p.offers.filter((o) => o.catalogue.status === "PUBLISHED");
    const prices = pubOffers.map((o) => o.salePrice).filter((v): v is number => v != null);
    const discounts = pubOffers.map((o) => o.discountPercentage).filter((v): v is number => v != null);
    const active = pubOffers
      .filter((o) => o.startDate <= now && o.endDate >= now && o.salePrice != null)
      .sort((a, b) => (a.salePrice as number) - (b.salePrice as number))[0];
    return {
      id: p.id,
      slug: p.slug ?? p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      imageUrl: toPublicImageUrl(p.imageUrl),
      offerCount: pubOffers.length,
      bestPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxDiscount: discounts.length > 0 ? Math.max(...discounts) : null,
      currentOffer: active
        ? {
            salePrice: active.salePrice,
            originalPrice: active.originalPrice,
            discountPercentage: active.discountPercentage,
            catalogueSlug: active.catalogue.slug,
            catalogueTitle: active.catalogue.title,
            pageNumber: active.cataloguePage?.pageNumber ?? null,
            endDate: active.endDate,
          }
        : null,
      lastSeen: pubOffers.length > 0 ? pubOffers.reduce((m, o) => (o.startDate > m ? o.startDate : m), pubOffers[0].startDate) : null,
    };
  });

  // Preserve the requested order (missing slugs are simply absent).
  const order = new Map(slugs.map((s, i) => [s.toLowerCase(), i]));
  products.sort((a, b) => {
    const ai = order.has(a.slug.toLowerCase()) ? order.get(a.slug.toLowerCase())! : order.get(a.id.toLowerCase()) ?? 999;
    const bi = order.has(b.slug.toLowerCase()) ? order.get(b.slug.toLowerCase())! : order.get(b.id.toLowerCase()) ?? 999;
    return ai - bi;
  });

  return NextResponse.json({ products });
}
