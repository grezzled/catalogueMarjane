import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * "Deal" collections: curated promotion pages (e.g. under 100 DH, -50%+).
 *
 * Rule: a deal page only exists when there is enough REAL data behind it.
 * Every entry point is gated by MIN_DEAL_PRODUCTS (unique active products):
 * - the page itself calls notFound() below the threshold (no thin content),
 * - getActiveDeals() only returns deals above it (homepage, sitemap, index).
 */
export const MIN_DEAL_PRODUCTS = 10;

export interface DealDef {
  slug: string;
  /** Short label for breadcrumbs / pills. */
  label: string;
  /** H1. */
  title: string;
  metaTitle: string;
  metaDescription: (count: number) => string;
  /** "84 produits actuellement disponibles à moins de 100 DH" style line. */
  countLine: (count: number) => string;
  /** 1-2 sentence SEO paragraph; receives live count + top categories. */
  seoText: (count: number, topCategories: string[]) => string;
  where: Prisma.OfferWhereInput;
  orderBy: Prisma.OfferOrderByWithRelationInput;
}

export const DEALS: DealDef[] = [
  {
    slug: "meilleures-promotions",
    label: "Meilleures promotions",
    title: "Meilleures promotions Marjane",
    metaTitle: "Meilleures promotions Marjane - Top remises en cours",
    metaDescription: (count) =>
      `Les ${count} meilleures promotions Marjane en cours : remises de 30% et plus sur l'électroménager, l'alimentation, la maison et le high-tech au Maroc.`,
    countLine: (count) =>
      `${count} produit${count !== 1 ? "s" : ""} en promotion à -30% et plus, actuellement disponible${count !== 1 ? "s" : ""}`,
    seoText: (count, topCategories) =>
      `Cette sélection rassemble les ${count} plus grosses remises Marjane du moment, toutes à -30% minimum et vérifiées sur les catalogues en cours. ${
        topCategories.length > 0
          ? `Les meilleures affaires se trouvent surtout en ${topCategories.join(", ")}.`
          : ""
      } Les remises évoluent à chaque catalogue : revenez chaque semaine pour ne rater aucune chute de prix.`,
    where: { discountPercentage: { gte: 30 } },
    orderBy: { discountPercentage: "desc" },
  },
  {
    slug: "50-pourcent-et-plus",
    label: "-50% et plus",
    title: "Promotions Marjane à -50% et plus",
    metaTitle: "Promotions Marjane à -50% et plus - Moitié prix",
    metaDescription: (count) =>
      `Les ${count} produits à moitié prix ou moins chez Marjane : remises de 50% et plus sur les catalogues en cours au Maroc.`,
    countLine: (count) =>
      `${count} produit${count !== 1 ? "s" : ""} à moitié prix ou moins, actuellement disponible${count !== 1 ? "s" : ""}`,
    seoText: (count, topCategories) =>
      `Moitié prix ou moins : voici les ${count} produits Marjane affichant une remise de 50% ou plus dans les catalogues en cours. ${
        topCategories.length > 0
          ? `On y trouve notamment des offres en ${topCategories.join(", ")}.`
          : ""
      } Ces remises exceptionnelles partent vite et les stocks sont limités : vérifiez toujours la disponibilité en magasin.`,
    where: { discountPercentage: { gte: 50 } },
    orderBy: { discountPercentage: "desc" },
  },
  {
    slug: "moins-de-100-dh",
    label: "Moins de 100 DH",
    title: "Promotions Marjane à moins de 100 DH",
    metaTitle: "Promotions Marjane à moins de 100 DH - Petits prix",
    metaDescription: (count) =>
      `${count} produits Marjane à moins de 100 DH : petits prix et bonnes affaires sur l'alimentation, l'entretien et le quotidien au Maroc.`,
    countLine: (count) =>
      `${count} produit${count !== 1 ? "s" : ""} actuellement disponible${count !== 1 ? "s" : ""} à moins de 100 DH`,
    seoText: (count, topCategories) =>
      `Pas besoin de gros budget pour profiter des promotions Marjane : ${count} produits sont actuellement proposés à moins de 100 DH dans les catalogues en cours. ${
        topCategories.length > 0
          ? `Idéal pour l'alimentation et le quotidien, avec de nombreuses offres en ${topCategories.join(", ")}.`
          : ""
      } Parfait pour remplir le panier sans se ruiner, chaque semaine.`,
    where: { salePrice: { lt: 100 } },
    orderBy: { salePrice: "asc" },
  },
];

export function getDeal(slug: string): DealDef | undefined {
  return DEALS.find((d) => d.slug === slug);
}

/** Active-offers filter shared by every deal query (mirrors /promotions-marjane). */
function activeFilter(now: Date): Prisma.OfferWhereInput {
  return {
    startDate: { lte: now },
    endDate: { gte: now },
    catalogue: { status: "PUBLISHED" },
  };
}

type Db = Pick<typeof prisma, "offer">;

const offerInclude = {
  product: true,
  catalogue: {
    include: {
      articles: {
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, slug: true },
      },
    },
  },
  cataloguePage: {
    select: { imagePath: true, pageNumber: true, aiAnalysis: true },
  },
} as const;

/**
 * Deals with enough live data, each with its unique active product count.
 * Everything that links to a deal page (homepage, index, sitemap) must use
 * this — never DEALS directly.
 */
export async function getActiveDeals(
  db: Db = prisma
): Promise<{ deal: DealDef; productCount: number }[]> {
  const now = new Date();
  const out: { deal: DealDef; productCount: number }[] = [];
  for (const deal of DEALS) {
    const rows = await db.offer.findMany({
      where: { ...activeFilter(now), ...deal.where },
      select: { productId: true },
    });
    const productCount = new Set(rows.map((r) => r.productId)).size;
    if (productCount >= MIN_DEAL_PRODUCTS) {
      out.push({ deal, productCount });
    }
  }
  return out;
}

/** Light live count for metadata (no offers fetched). */
export async function getDealProductCount(
  slug: string,
  db: Db = prisma
): Promise<number | null> {
  const deal = getDeal(slug);
  if (!deal) return null;
  const rows = await db.offer.findMany({
    where: { ...activeFilter(new Date()), ...deal.where },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId)).size;
}

/**
 * Full page data, or null when the deal is unknown or below the data
 * threshold. Callers render notFound() on null.
 */
export async function getDealPageData(
  slug: string,
  db: Db = prisma
): Promise<{
  deal: DealDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offers: any[];
  productCount: number;
  topCategories: string[];
} | null> {
  const deal = getDeal(slug);
  if (!deal) return null;
  const rows = await db.offer.findMany({
    where: { ...activeFilter(new Date()), ...deal.where },
    include: offerInclude,
    orderBy: deal.orderBy,
    take: 200,
  });
  const seen = new Set<string>();
  const offers = rows
    .filter((o) => {
      if (seen.has(o.productId)) return false;
      seen.add(o.productId);
      return true;
    })
    .slice(0, 60);
  const productCount = seen.size;
  if (productCount < MIN_DEAL_PRODUCTS) return null;

  const catCount = new Map<string, number>();
  for (const o of offers) {
    const name = (o.product as { category: string }).category;
    catCount.set(name, (catCount.get(name) ?? 0) + 1);
  }
  const topCategories = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return { deal, offers, productCount, topCategories };
}
