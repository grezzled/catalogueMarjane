import type { PrismaClient } from "@prisma/client";

/**
 * Article intents for per-catalogue generation. Each type defines its own
 * data slice (which offers feed the AI context + verified table), its prompt
 * angle, and a minimum-data gate — focused articles are refused when the
 * slice is too thin.
 *
 * NOTE: this module is imported by client components (badges, picker), so
 * it must stay free of server-only imports — the DB handle is always passed
 * explicitly, never imported.
 */
export const OVERVIEW_TYPE = "overview";

export interface ArticleTypeDef {
  id: string;
  label: string;
  description: string;
  /** When true the admin must also pick a category (focus). */
  needsCategory: boolean;
  /** Minimum slice size, otherwise generation is refused. */
  minOffers: number;
}

export const ARTICLE_TYPES: ArticleTypeDef[] = [
  {
    id: "overview",
    label: "Vue d'ensemble",
    description: "Guide complet du catalogue : tous les rayons, offres clés et conseils.",
    needsCategory: false,
    minOffers: 3,
  },
  {
    id: "category_focus",
    label: "Focus catégorie",
    description: "Zoom sur un seul rayon du catalogue (ex : High-Tech, Épicerie).",
    needsCategory: true,
    minOffers: 5,
  },
  {
    id: "top_deals",
    label: "Top remises",
    description: "Les plus grosses remises du catalogue (-20% et plus).",
    needsCategory: false,
    minOffers: 5,
  },
  {
    id: "budget",
    label: "Petits prix",
    description: "Les bonnes affaires à moins de 100 DH.",
    needsCategory: false,
    minOffers: 5,
  },
  {
    id: "buying_guide",
    label: "Guide d'achat",
    description: "Conseils pour bien choisir dans un rayon (critères, comparatifs).",
    needsCategory: true,
    minOffers: 5,
  },
];

export function getArticleType(id: string | null | undefined): ArticleTypeDef {
  return ARTICLE_TYPES.find((t) => t.id === id) ?? ARTICLE_TYPES[0];
}

export function articleTypeLabel(id: string | null | undefined): string {
  return getArticleType(id).label;
}

export interface CategoryOption {
  name: string;
  offerCount: number;
}

export interface ArticleTypeOption extends ArticleTypeDef {
  /** Live slice size for this catalogue. */
  offerCount: number;
  available: boolean;
  /** Eligible focus categories (only for needsCategory types). */
  categories: CategoryOption[];
}

type Db = Pick<PrismaClient, "offer">;

interface SliceOffer {
  discountPercentage: number | null;
  salePrice: number | null;
  product: { category: string };
}

/** Data slice per type. Category-scoped types require `category`. */
export function selectOffersForType<T extends SliceOffer>(
  offers: T[],
  typeId: string,
  category?: string | null
): T[] {
  const byDiscountDesc = [...offers].sort(
    (a, b) => (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0)
  );
  switch (typeId) {
    case "category_focus":
    case "buying_guide": {
      if (!category) return [];
      const inCat = (o: T) => o.product.category === category;
      return byDiscountDesc.filter(inCat).slice(0, 15);
    }
    case "top_deals":
      return byDiscountDesc
        .filter((o) => (o.discountPercentage ?? 0) >= 20)
        .slice(0, 15);
    case "budget":
      return byDiscountDesc
        .filter((o) => o.salePrice != null && o.salePrice < 100)
        .slice(0, 15);
    case "overview":
    default:
      return byDiscountDesc
        .filter((o) => (o.discountPercentage ?? 0) > 10)
        .slice(0, 20);
  }
}

/**
 * Live availability per type for one catalogue — drives the admin picker
 * (counts, disabled states, eligible focus categories).
 */
export async function getArticleTypeOptions(
  catalogueId: string,
  db: Db
): Promise<ArticleTypeOption[]> {
  const offers = await db.offer.findMany({
    where: { catalogueId },
    select: {
      discountPercentage: true,
      salePrice: true,
      product: { select: { category: true } },
    },
  });

  const catCounts = new Map<string, number>();
  for (const o of offers) {
    const name = o.product.category?.trim() || "Autres";
    catCounts.set(name, (catCounts.get(name) ?? 0) + 1);
  }
  const eligibleCategories: CategoryOption[] = [...catCounts.entries()]
    .filter(([, n]) => n >= 5)
    .map(([name, offerCount]) => ({ name, offerCount }))
    .sort((a, b) => b.offerCount - a.offerCount);

  return ARTICLE_TYPES.map((def) => {
    const slice = selectOffersForType(offers, def.id, undefined);
    // Category-scoped types are available when ≥1 eligible category exists;
    // the slice (and its own gate) is evaluated once a category is picked.
    const available = def.needsCategory
      ? eligibleCategories.length > 0
      : slice.length >= def.minOffers;
    return {
      ...def,
      offerCount: def.needsCategory ? offers.length : slice.length,
      available,
      categories: def.needsCategory ? eligibleCategories : [],
    };
  });
}

/**
 * Validate a (type, category) choice against live data. Returns null when
 * valid, otherwise the refusal reason (also enforced in the worker).
 */
export async function validateArticleTypeChoice(
  catalogueId: string,
  typeId: string,
  category: string | null | undefined,
  db: Db
): Promise<string | null> {
  const def = getArticleType(typeId);
  if (def.needsCategory && !category?.trim()) {
    return `Le type « ${def.label} » nécessite une catégorie.`;
  }
  const offers = await db.offer.findMany({
    where: { catalogueId },
    select: {
      discountPercentage: true,
      salePrice: true,
      product: { select: { category: true } },
    },
  });
  const slice = selectOffersForType(offers, def.id, category?.trim() || undefined);
  if (slice.length < def.minOffers) {
    return `Pas assez de données pour « ${def.label} » (${slice.length} offre(s), minimum ${def.minOffers}).`;
  }
  return null;
}
