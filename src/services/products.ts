import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { slugify } from "@/lib/utils";
import { normalizeProductName } from "@/services/product-identity";

/** Public image URL for a stored product/page image path. */
export function toPublicImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  const idx = imagePath.indexOf("uploads/");
  if (idx !== -1) return "/" + imagePath.slice(idx);
  return imagePath;
}

/** URL slug base for a product (name only, no ID). */
export function baseProductSlug(name: string): string {
  return slugify(name).slice(0, 60).replace(/^-|-$/g, "") || "produit";
}

/**
 * Unique name slug. Collisions get a counter suffix (cola-1l, cola-1l-2…).
 * Never renames on enrich — call once at creation / migration for stable URLs.
 */
export async function uniqueProductSlug(name: string, excludeId?: string): Promise<string> {
  const base = baseProductSlug(name);
  let candidate = base;
  let n = 1;
  for (;;) {
    const hit = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit || hit.id === excludeId) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

/**
 * Assign a unique slug to a product, retrying on unique-constraint races.
 * Two products can never share a URL: the app checks first AND the DB
 * unique constraint rejects duplicates. The retry only matters if two
 * workers ever create same-name products concurrently.
 */
export async function assignProductSlug(id: string, name: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const slug = await uniqueProductSlug(name, id);
    try {
      await prisma.product.update({ where: { id }, data: { slug } });
      return slug;
    } catch (e) {
      const isConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isConflict || attempt === retries - 1) throw e;
      // Slug taken concurrently — loop recomputes the next free suffix.
    }
  }
  throw new Error("Failed to assign product slug");
}
export async function migrateProductSlugs(): Promise<{ updated: number }> {
  const all = await prisma.product.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });
  let updated = 0;
  for (const p of all) {
    const slug = await uniqueProductSlug(p.name, p.id);
    if (slug !== p.slug) {
      await prisma.product.update({ where: { id: p.id }, data: { slug } });
      updated++;
    }
  }
  return { updated };
}

export interface ProductSearchParams {
  q?: string;
  category?: string;
  brand?: string;
  minDiscount?: number;
  maxPrice?: number;
  inPromo?: boolean;
  sort?: "relevant" | "price-asc" | "price-desc" | "discount" | "recent";
  page?: number;
  perPage?: number;
}

export interface CurrentOffer {
  salePrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  catalogueSlug: string;
  catalogueTitle: string;
  /** Exact catalogue page — link to `/catalogue-marjane/[slug]#page-N`. */
  pageNumber: number | null;
  endDate: Date;
}

export interface ProductResult {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  imageUrl: string | null;
  offerCount: number;
  bestPrice: number | null;
  maxDiscount: number | null;
  currentOffer: CurrentOffer | null;
  lastSeen: Date | null;
}

export interface ProductSearchResult {
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  results: ProductResult[];
}

function tokenize(raw: string): string[] {
  return normalizeProductName(raw).split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

/** Advanced product search. Token-AND on the normalized name + filters, scored in JS. */
export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
  const {
    q = "",
    category,
    brand,
    minDiscount = 0,
    maxPrice,
    inPromo = false,
    sort = "relevant",
    page = 1,
    perPage = 24,
  } = params;
  const now = new Date();
  const tokens = tokenize(q);

  // No `take` cap: scoring, price/discount filters and sorting run in JS
  // over the full candidate set (catalogue is small enough for SQLite).
  const candidates = await prisma.product.findMany({
    where: {
      ...(tokens.length > 0
        ? {
            AND: tokens.map((t) => ({
              OR: [{ normalizedName: { contains: t } }, { brand: { contains: t } }],
            })),
          }
        : {}),
      ...(category ? { category } : {}),
      ...(brand ? { brand } : {}),
    },
    include: {
      offers: {
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

  const scored: { score: number; item: ProductResult }[] = [];
  for (const p of candidates) {
    const pubOffers = p.offers.filter((o) => o.catalogue.status === "PUBLISHED");
    if (pubOffers.length === 0) continue;
    const prices = pubOffers.map((o) => o.salePrice).filter((v): v is number => v != null);
    const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
    const discounts = pubOffers.map((o) => o.discountPercentage).filter((v): v is number => v != null);
    const maxDiscount = discounts.length > 0 ? Math.max(...discounts) : null;
    if (minDiscount > 0 && (maxDiscount ?? 0) < minDiscount) continue;
    if (maxPrice != null && (bestPrice == null || bestPrice > maxPrice)) continue;

    const active = pubOffers
      .filter((o) => o.startDate <= now && o.endDate >= now && o.salePrice != null)
      .sort((a, b) => (a.salePrice as number) - (b.salePrice as number))[0];
    if (inPromo && !active) continue;

    const lastSeen = pubOffers.reduce((m, o) => (o.startDate > m ? o.startDate : m), pubOffers[0].startDate);

    // Relevance: token coverage + name position + offer richness.
    let score = 0;
    if (tokens.length > 0) {
      const norm = p.normalizedName;
      for (const t of tokens) {
        if (norm === t) score += 10;
        else if (norm.startsWith(t)) score += 5;
        else if (norm.includes(t)) score += 2;
      }
      if (p.brand && tokens.some((t) => p.brand!.toLowerCase().includes(t))) score += 3;
    } else {
      score = pubOffers.length;
    }
    score += Math.min(pubOffers.length, 10) * 0.2;
    if (active) score += 2;

    scored.push({
      score,
      item: {
        id: p.id,
        slug: p.slug ?? p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        imageUrl: toPublicImageUrl(p.imageUrl),
        offerCount: pubOffers.length,
        bestPrice,
        maxDiscount,
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
        lastSeen,
      },
    });
  }

  switch (sort) {
    case "price-asc":
      scored.sort((a, b) => (a.item.bestPrice ?? Infinity) - (b.item.bestPrice ?? Infinity));
      break;
    case "price-desc":
      scored.sort((a, b) => (b.item.bestPrice ?? -Infinity) - (a.item.bestPrice ?? -Infinity));
      break;
    case "discount":
      scored.sort((a, b) => (b.item.maxDiscount ?? -1) - (a.item.maxDiscount ?? -1));
      break;
    case "recent":
      scored.sort((a, b) => +(b.item.lastSeen ?? 0) - +(a.item.lastSeen ?? 0));
      break;
    default:
      scored.sort((a, b) => b.score - a.score);
  }

  const total = scored.length;
  const safePage = Math.max(1, page);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const results = scored.slice((safePage - 1) * perPage, safePage * perPage).map((s) => s.item);
  return { total, page: safePage, perPage, pageCount, results };
}

export interface PricePoint {
  date: string;
  salePrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  catalogueSlug: string;
  catalogueTitle: string;
  pageNumber: number | null;
  endDate: string;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  specifications: string | null;
  imageUrl: string | null;
  offerCount: number;
  history: PricePoint[];
  stats: {
    lowest: number | null;
    highest: number | null;
    average: number | null;
    firstSeen: string | null;
    lastSeen: string | null;
  };
  currentOffer: ProductResult["currentOffer"];
  /** True when other products share this exact name (needs title disambiguation). */
  duplicateName: boolean;
}
/** Full product + chronological price history (one point per offer). */
export async function getProductDetail(slugOrId: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: {
      offers: {
        where: { catalogue: { status: "PUBLISHED" } },
        select: {
          salePrice: true,
          originalPrice: true,
          discountPercentage: true,
          startDate: true,
          endDate: true,
          catalogue: { select: { slug: true, title: true } },
          cataloguePage: { select: { pageNumber: true } },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });
  if (!product) return null;

  const now = new Date();
  const history: PricePoint[] = product.offers.map((o) => ({    date: o.startDate.toISOString(),
    salePrice: o.salePrice,
    originalPrice: o.originalPrice,
    discountPercentage: o.discountPercentage,
    catalogueSlug: o.catalogue.slug,
    catalogueTitle: o.catalogue.title,
    pageNumber: o.cataloguePage?.pageNumber ?? null,
    endDate: o.endDate.toISOString(),
  }));
  const sales = history.map((h) => h.salePrice).filter((v): v is number => v != null);
  const active = product.offers
    .filter((o) => o.startDate <= now && o.endDate >= now && o.salePrice != null)
    .sort((a, b) => (a.salePrice as number) - (b.salePrice as number))[0];
  const duplicateName = (await prisma.product.count({ where: { name: product.name } })) > 1;

  return {
    id: product.id,
    slug: product.slug ?? product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    imageUrl: toPublicImageUrl(product.imageUrl),
    specifications: product.specifications,
    offerCount: product.offers.length,
    history,
    stats: {
      lowest: sales.length > 0 ? Math.min(...sales) : null,
      highest: sales.length > 0 ? Math.max(...sales) : null,
      average: sales.length > 0 ? sales.reduce((s, v) => s + v, 0) / sales.length : null,
      firstSeen: history.length > 0 ? history[0].date : null,
      lastSeen: history.length > 0 ? history[history.length - 1].date : null,
    },
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
    duplicateName,
  };
}

/** Related products: same category first, then same brand. */
export async function getRelatedProducts(productId: string, category: string, brand: string | null): Promise<ProductResult[]> {
  const related = await prisma.product.findMany({
    where: {
      id: { not: productId },
      OR: [{ category }, ...(brand ? [{ brand }] : [])],
      offers: { some: { catalogue: { status: "PUBLISHED" } } },
    },
    include: {
      offers: {
        where: { catalogue: { status: "PUBLISHED" } },
        select: {
          salePrice: true,
          discountPercentage: true,
          startDate: true,
          endDate: true,
          catalogue: { select: { slug: true, title: true, status: true } },
          originalPrice: true,
          cataloguePage: { select: { pageNumber: true } },
        },
      },
    },
    take: 30,
  });
  const now = new Date();
  return related
    .map((p) => {
      const prices = p.offers.map((o) => o.salePrice).filter((v): v is number => v != null);
      const discounts = p.offers.map((o) => o.discountPercentage).filter((v): v is number => v != null);
      const active = p.offers
        .filter((o) => o.startDate <= now && o.endDate >= now && o.salePrice != null)
        .sort((a, b) => (a.salePrice as number) - (b.salePrice as number))[0];
      return {
        id: p.id,
        slug: p.slug ?? p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        imageUrl: toPublicImageUrl(p.imageUrl),
        offerCount: p.offers.length,
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
        lastSeen: p.offers.length > 0 ? p.offers.reduce((m, o) => (o.startDate > m ? o.startDate : m), p.offers[0].startDate) : null,
      };
    })
    .sort((a, b) => {
      const aCat = a.category === category ? 0 : 1;
      const bCat = b.category === category ? 0 : 1;
      if (aCat !== bCat) return aCat - bCat;
      return b.offerCount - a.offerCount;
    })
    .slice(0, 8);
}

/** Filter options with counts for the advanced search form. */
export async function getSearchFacets(): Promise<{ categories: { name: string; count: number }[]; brands: { name: string; count: number }[] }> {
  const [cats, brands] = await Promise.all([
    prisma.product.groupBy({ by: ["category"], _count: { category: true }, orderBy: { _count: { category: "desc" } }, take: 100 }),
    prisma.product.groupBy({ by: ["brand"], _count: { brand: true }, orderBy: { _count: { brand: "desc" } }, take: 60 }),
  ]);
  return {
    categories: cats.map((c) => ({ name: c.category, count: c._count.category })),
    brands: brands.filter((b) => b.brand).map((b) => ({ name: b.brand as string, count: b._count.brand })),
  };
}

export interface TrendingProduct {
  product: ProductResult;
  /** Page views in the window (first-party beacon, real browsers only). */
  views: number;
}

type OfferSummary = {
  salePrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  startDate: Date;
  endDate: Date;
  catalogue: { slug: string; title: string; status: string };
  cataloguePage: { pageNumber: number } | null;
};

type SummarizableProduct = {
  id: string;
  slug: string | null;
  name: string;
  brand: string | null;
  category: string;
  imageUrl: string | null;
  offers: OfferSummary[];
};

/** Shared ProductResult mapping (prices, current offer, last seen). */
export function toProductResult(
  p: SummarizableProduct,
  now: Date = new Date()
): ProductResult {
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
}

/**
 * Fallback when the beacon has no data yet (fresh deploy): products with
 * the richest price histories. No view counts — callers must not label
 * these as "most viewed".
 */
export async function getMostFollowedProducts(take = 4): Promise<ProductResult[]> {
  const rows = await prisma.product.findMany({
    where: { offers: { some: { catalogue: { status: "PUBLISHED" } } } },
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
    take: 300,
  });
  return rows
    .map((p) => toProductResult(p))
    .filter((r) => r.offerCount > 0)
    .sort((a, b) => b.offerCount - a.offerCount || (b.maxDiscount ?? -1) - (a.maxDiscount ?? -1))
    .slice(0, take);
}

/**
 * Most-viewed product pages over the last `days` days, resolved to
 * products with current prices. Empty until the beacon collects data —
 * callers should hide the section when there is nothing to show.
 */
export async function getTrendingProducts(days = 7, take = 8): Promise<TrendingProduct[]> {
  const since = new Date(Date.now() - days * 86400 * 1000);
  const hits = await prisma.pageView.findMany({
    where: { createdAt: { gte: since }, path: { startsWith: "/produit/" } },
    select: { path: true },
  });
  const counts = new Map<string, number>();
  for (const h of hits) {
    const slug = h.path.split("/")[2]?.split("?")[0]?.trim();
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, take);
  if (top.length === 0) return [];

  const keys = top.map(([s]) => s);
  const now = new Date();
  const rows = await prisma.product.findMany({
    where: {
      OR: [{ slug: { in: keys } }, { id: { in: keys } }],
      offers: { some: { catalogue: { status: "PUBLISHED" } } },
    },
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

  const byKey = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    byKey.set(r.slug?.toLowerCase() ?? "", r);
    byKey.set(r.id.toLowerCase(), r);
  }
  const out: TrendingProduct[] = [];
  for (const [slug, views] of top) {
    const p = byKey.get(slug.toLowerCase());
    if (!p) continue;
    const prices = p.offers.map((o) => o.salePrice).filter((v): v is number => v != null);
    const discounts = p.offers.map((o) => o.discountPercentage).filter((v): v is number => v != null);
    const active = p.offers
      .filter((o) => o.startDate <= now && o.endDate >= now && o.salePrice != null)
      .sort((a, b) => (a.salePrice as number) - (b.salePrice as number))[0];
    out.push({
      views,
      product: {
        id: p.id,
        slug: p.slug ?? p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        imageUrl: toPublicImageUrl(p.imageUrl),
        offerCount: p.offers.length,
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
        lastSeen: p.offers.length > 0 ? p.offers.reduce((m, o) => (o.startDate > m ? o.startDate : m), p.offers[0].startDate) : null,
      },
    });
  }
  return out;
}
