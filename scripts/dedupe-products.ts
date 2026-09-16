/**
 * Product deduplication maintenance.
 *
 * 1. Backfills identity fields (identityKey, modelNumber, size, variant,
 *    coreName) on rows created before smart matching existed.
 * 2. Reports clusters of duplicate products (same identityKey, or same
 *    brand+model with diverging keys for manual review).
 *
 * Dry run by default. Pass --apply to merge strict-duplicate clusters:
 * keeps the product with the most offers (tie → oldest), repoints offers
 * + article links, deletes the rest.
 *
 *   npx tsx scripts/dedupe-products.ts            # report only
 *   npx tsx scripts/dedupe-products.ts --apply    # merge strict dupes
 */
import { prisma } from "../src/lib/prisma";
import { buildIdentity } from "../src/services/product-identity";

const APPLY = process.argv.includes("--apply");

function parseSpecs(specifications: string | null): string[] | null {
  if (!specifications) return null;
  try {
    const parsed: unknown = JSON.parse(specifications);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === "object" && parsed !== null) return Object.values(parsed).map(String);
  } catch {
    return [specifications];
  }
  return null;
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      brand: true,
      normalizedName: true,
      identityKey: true,
      modelNumber: true,
      size: true,
      sizeNum: true,
      variant: true,
      coreName: true,
      specifications: true,
      createdAt: true,
      _count: { select: { offers: true, articleProducts: true } },
    },
  });
  console.log(`Scanned ${products.length} products (${APPLY ? "APPLY" : "dry run"}).`);

  // Pass 1 — backfill missing identity fields.
  let backfilled = 0;
  for (const p of products) {
    if (p.identityKey) continue;
    const id = buildIdentity({ name: p.name, brand: p.brand, specs: parseSpecs(p.specifications) });
    await prisma.product.update({
      where: { id: p.id },
      data: {
        identityKey: id.identityKey,
        modelNumber: id.modelNumber,
        size: id.size,
        sizeNum: id.sizeNum,
        variant: id.variant,
        coreName: id.coreName,
      },
    });
    p.identityKey = id.identityKey;
    p.modelNumber = id.modelNumber;
    p.size = id.size;
    p.sizeNum = id.sizeNum;
    p.variant = id.variant;
    p.coreName = id.coreName;
    backfilled++;
  }
  console.log(`Backfilled identity on ${backfilled} rows.`);

  // Pass 2 — cluster strict duplicates (identical identityKey).
  // Signal-less keys (empty core, no model/size/variant) are extraction
  // junk — reported, never auto-merged.
  const byKey = new Map<string, typeof products>();
  for (const p of products) {
    const list = byKey.get(p.identityKey! as string) ?? [];
    list.push(p);
    byKey.set(p.identityKey! as string, list);
  }
  const hasSignal = (p: (typeof products)[number]) =>
    (p.coreName ?? "") !== "" || p.modelNumber != null || p.size != null || p.variant != null;
  const strictClusters = [...byKey.values()].filter((g) => g.length > 1 && hasSignal(g[0]));
  const junkClusters = [...byKey.values()].filter((g) => g.length > 1 && !hasSignal(g[0]));

  // Pass 3 — same brand+model, diverging keys (review only, never auto-merged).
  const byModel = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.modelNumber || !p.brand) continue;
    const k = `${p.brand.toLowerCase()}|${p.modelNumber}`;
    const list = byModel.get(k) ?? [];
    list.push(p);
    byModel.set(k, list);
  }
  const modelReview = [...byModel.entries()].filter(
    ([, g]) => g.length > 1 && new Set(g.map((p) => p.identityKey)).size > 1
  );

  const strictDupes = strictClusters.reduce((n, g) => n + g.length - 1, 0);
  console.log(
    `\nStrict duplicates: ${strictDupes} rows in ${strictClusters.length} clusters (auto-merge ${APPLY ? "ON" : "OFF"}).`
  );
  for (const g of strictClusters.slice(0, 50)) {
    console.log(`\n  key=${g[0].identityKey}`);
    for (const p of g) {
      console.log(
        `    - ${p.name.slice(0, 80)} [${p._count.offers} offers, ${p.id.slice(0, 8)}]`
      );
    }
  }
  if (strictClusters.length > 50) console.log(`  …and ${strictClusters.length - 50} more clusters.`);

  if (junkClusters.length > 0) {
    console.log(
      `\nJunk clusters (no signal — reported only, never merged): ${junkClusters.reduce((n, g) => n + g.length - 1, 0)} rows in ${junkClusters.length} clusters.`
    );
    for (const g of junkClusters.slice(0, 10)) {
      console.log(`\n  key=${g[0].identityKey}`);
      for (const p of g) console.log(`    - ${p.name.slice(0, 80)} [${p._count.offers} offers]`);
    }
  }

  console.log(
    `\nSame brand+model, diverging identity (manual review): ${modelReview.length} clusters.`
  );
  for (const [k, g] of modelReview.slice(0, 20)) {
    console.log(`\n  ${k}`);
    for (const p of g) {
      console.log(`    - ${p.name.slice(0, 80)} (size=${p.size ?? "?"}, variant=${p.variant ?? "?"})`);
    }
  }

  if (APPLY && strictClusters.length > 0) {
    let merged = 0;
    for (const g of strictClusters) {
      const sorted = [...g].sort(
        (a, b) => b._count.offers - a._count.offers || a.createdAt.getTime() - b.createdAt.getTime()
      );
      const [keeper, ...dupes] = sorted;
      // Fill keeper gaps from duplicates (same key → same values, but legacy rows may lack columns).
      const patch: Record<string, string | number | null> = {};
      if (!keeper.modelNumber) patch.modelNumber = dupes.find((d) => d.modelNumber)?.modelNumber ?? null;
      if (!keeper.size) {
        const donor = dupes.find((d) => d.size);
        if (donor) {
          patch.size = donor.size;
          patch.sizeNum = donor.sizeNum;
        }
      }
      if (!keeper.variant) patch.variant = dupes.find((d) => d.variant)?.variant ?? null;
      if (Object.keys(patch).length > 0) {
        await prisma.product.update({ where: { id: keeper.id }, data: patch });
      }
      for (const d of dupes) {
        await prisma.offer.updateMany({ where: { productId: d.id }, data: { productId: keeper.id } });
        // Repoint article links, dropping ones the keeper already has (unique constraint).
        const links = await prisma.articleProduct.findMany({
          where: { productId: d.id },
          select: { id: true, articleId: true },
        });
        for (const link of links) {
          const exists = await prisma.articleProduct.findUnique({
            where: { articleId_productId: { articleId: link.articleId, productId: keeper.id } },
          });
          if (exists) {
            await prisma.articleProduct.delete({ where: { id: link.id } });
          } else {
            await prisma.articleProduct.update({
              where: { id: link.id },
              data: { productId: keeper.id },
            });
          }
        }
        await prisma.product.delete({ where: { id: d.id } });
        merged++;
      }
    }
    console.log(`\nMerged ${merged} duplicate rows.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
