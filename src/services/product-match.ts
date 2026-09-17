/**
 * Database-backed product matching built on product-identity.ts.
 *
 * findMatchingProduct() replaces the legacy
 *   prisma.product.findFirst({ where: { normalizedName } })
 * with a 3-tier lookup: model ref → identity key → legacy exact name.
 * On a match it also returns enrichment data (identity fields the stored
 * row is still missing) so rows converge toward complete identities.
 */
import { prisma } from "@/lib/prisma";
import {
  buildIdentity,
  hasStrongSignals,
  legacyMatches,
  matchIdentity,
  normalizeBrandKey,
  normalizeProductName,
  type MatchTier,
  type ProductIdentity,
} from "@/services/product-identity";

export interface IncomingProduct {
  name: string;
  /** Already-resolved brand (AI value or detectBrand result). */
  brand?: string | null;
  /** AI-extracted manufacturer reference. */
  modelNumber?: string | null;
  /** Free-text specs (features array). */
  specs?: string[] | string | null;
}

export interface MatchedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  tier: Exclude<MatchTier, null> | "legacy";
}

export interface MatchResult {
  identity: ProductIdentity;
  /** Fields to persist on create. */
  fields: {
    normalizedName: string;
    identityKey: string;
    modelNumber: string | null;
    size: string | null;
    sizeNum: number | null;
    variant: string | null;
    coreName: string;
  };
  match: MatchedProduct | null;
  /** Identity fields the matched row lacks — apply via prisma.product.update. */
  enrich: {
    identityKey?: string;
    modelNumber?: string | null;
    size?: string | null;
    sizeNum?: number | null;
    variant?: string | null;
    coreName?: string;
    brand?: string | null;
  } | null;
}

const CANDIDATE_SELECT = {
  id: true,
  name: true,
  normalizedName: true,
  brand: true,
  identityKey: true,
  modelNumber: true,
  size: true,
  sizeNum: true,
  variant: true,
  coreName: true,
  imageUrl: true,
} as const;

export async function findMatchingProduct(incoming: IncomingProduct): Promise<MatchResult> {
  const identity = buildIdentity({
    name: incoming.name,
    brand: incoming.brand,
    aiModelNumber: incoming.modelNumber,
    specs: incoming.specs,
  });

  const fields = {
    normalizedName: normalizeProductName(incoming.name),
    identityKey: identity.identityKey,
    modelNumber: identity.modelNumber,
    size: identity.size,
    sizeNum: identity.sizeNum,
    variant: identity.variant,
    coreName: identity.coreName,
  };

  const ors: Array<Record<string, unknown>> = [
    { identityKey: identity.identityKey },
    { normalizedName: fields.normalizedName },
  ];
  if (identity.modelNumber) ors.push({ modelNumber: identity.modelNumber });

  const candidates = await prisma.product.findMany({
    where: { OR: ors },
    select: CANDIDATE_SELECT,
  });

  // Tier priority: model (0) → key (1) → legacy (2).
  let best: (typeof candidates)[number] | null = null;
  let bestTier: Exclude<MatchTier, null> | "legacy" = "legacy";
  let bestRank = 3;

  for (const c of candidates) {
    const tier = matchIdentity(identity, {
      brand: c.brand,
      modelNumber: c.modelNumber,
      size: c.size,
      sizeNum: c.sizeNum,
      variant: c.variant,
      identityKey: c.identityKey,
      coreName: c.coreName,
      normalizedName: c.normalizedName,
      name: c.name,
    });
    const rank = tier === "model" ? 0 : tier === "key" ? 1 : 3;
    if (tier && rank < bestRank) {
      best = c;
      bestTier = tier;
      bestRank = rank;
      if (rank === 0) break;
    }
    if (!tier && bestRank > 2 && hasStrongSignals(identity) && legacyMatches(incoming.name, c.normalizedName)) {
      best = c;
      bestTier = "legacy";
      bestRank = 2;
    }
  }

  if (!best) {
    return { identity, fields, match: null, enrich: null };
  }

  // Enrich the stored row with identity fields it is still missing.
  const enrich: NonNullable<MatchResult["enrich"]> = {};
  if (!best.identityKey) enrich.identityKey = identity.identityKey;
  if (!best.coreName) enrich.coreName = identity.coreName;
  if (best.modelNumber == null && identity.modelNumber) enrich.modelNumber = identity.modelNumber;
  if (best.size == null && identity.size) {
    enrich.size = identity.size;
    enrich.sizeNum = identity.sizeNum;
  }
  if (best.variant == null && identity.variant) enrich.variant = identity.variant;
  if ((best.brand == null || best.brand === "") && identity.brand) {
    enrich.brand = incoming.brand?.trim() ? incoming.brand.trim() : null;
    if (!enrich.brand) delete enrich.brand;
  }

  return {
    identity,
    fields,
    match: best
      ? { id: best.id, name: best.name, imageUrl: best.imageUrl, tier: bestTier }
      : null,
    enrich: Object.keys(enrich).length > 0 ? enrich : null,
  };
}

/** Normalized brand for queries (mirrors identity keys). */
export function brandKey(brand: string | null | undefined): string {
  return normalizeBrandKey(brand);
}
