/**
 * Split over-merged products: one product row must not hold two different
 * prices within the same catalogue (a single item can't cost 89.95 and
 * 139 at once). Clusters offers by (catalogue, page, price); the biggest
 * cluster keeps the original row, the rest become new products with
 * re-cropped images matched from the page analysis boxes.
 *
 *   npx tsx scripts/split-merged-products.ts           # dry run
 *   npx tsx scripts/split-merged-products.ts --apply   # execute
 */
import { readFileSync, existsSync } from "fs";
import { dirname } from "path";
import { PrismaClient } from "@prisma/client";
import { cropProductImage } from "../src/services/cropping";
import { assignProductSlug } from "../src/services/products";
import { normalizeProductName } from "../src/services/product-identity";

function loadDotEnv(): void {
  const path = `${process.cwd()}/.env`;
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const APPLY = process.argv.includes("--apply");

interface Cluster {
  key: string;
  catalogueId: string;
  catalogueTitle: string;
  /** All pages this price appears on in the catalogue. */
  pages: { pageId: string; pageNumber: number }[];
  salePrice: number | null;
  offerIds: string[];
  earliest: Date;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const offers = await prisma.offer.findMany({
      where: { catalogue: { status: "PUBLISHED" } },
      select: {
        id: true,
        productId: true,
        catalogueId: true,
        cataloguePageId: true,
        salePrice: true,
        startDate: true,
        catalogue: { select: { title: true } },
        cataloguePage: { select: { pageNumber: true } },
      },
    });

    // Affected = >1 distinct sale price within one (product, catalogue).
    const byProdCat = new Map<string, { prices: Set<string>; productId: string }>();
    for (const o of offers) {
      const key = `${o.productId}|${o.catalogueId}`;
      let g = byProdCat.get(key);
      if (!g) {
        g = { prices: new Set(), productId: o.productId };
        byProdCat.set(key, g);
      }
      g.prices.add(o.salePrice == null ? "null" : String(o.salePrice));
    }
    const affectedIds = new Set(
      [...byProdCat.values()].filter((g) => g.prices.size > 1).map((g) => g.productId)
    );
    console.log(`Products with conflicting prices in one catalogue: ${affectedIds.size}`);

    let splits = 0;
    let crops = 0;
    const usedBoxes = new Map<string, Set<number>>(); // pageId -> analysis entry idx

    for (const productId of affectedIds) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) continue;
      const prodOffers = offers.filter((o) => o.productId === productId);

      const clusters = new Map<string, Cluster>();
      for (const o of prodOffers) {
        // Atom = (catalogue, price). Same price across pages stays together
        // (repeat feature or same item); different prices in one catalogue
        // are provably different items.
        const key = `${o.catalogueId}|${o.salePrice == null ? "null" : o.salePrice}`;
        let c = clusters.get(key);
        if (!c) {
          c = {
            key,
            catalogueId: o.catalogueId,
            catalogueTitle: o.catalogue.title,
            pages: [],
            salePrice: o.salePrice,
            offerIds: [],
            earliest: o.startDate,
          };
          clusters.set(key, c);
        }
        if (!c.pages.some((p) => p.pageId === o.cataloguePageId)) {
          c.pages.push({ pageId: o.cataloguePageId, pageNumber: o.cataloguePage.pageNumber });
        }
        c.offerIds.push(o.id);
        if (o.startDate < c.earliest) c.earliest = o.startDate;
      }
      const sorted = [...clusters.values()].sort(
        (a, b) => b.offerIds.length - a.offerIds.length || +a.earliest - +b.earliest
      );
      // Strong identity (manufacturer model ref): same model + same price
      // across catalogues is the same item → fold into one history.
      // Weak identities stay per-catalogue: shared .95 price points collide
      // across distinct items all the time.
      if (product.modelNumber) {
        const byPrice = new Map<string, Cluster[]>();
        for (const c of sorted) {
          const k = c.salePrice == null ? "null" : String(c.salePrice);
          const arr = byPrice.get(k) ?? [];
          arr.push(c);
          byPrice.set(k, arr);
        }
        sorted.length = 0;
        for (const group of byPrice.values()) {
          group.sort((a, b) => +a.earliest - +b.earliest);
          const [first, ...others] = group;
          for (const o of others) {
            first.offerIds.push(...o.offerIds);
            for (const p of o.pages) {
              if (!first.pages.some((q) => q.pageId === p.pageId)) first.pages.push(p);
            }
            if (o.earliest < first.earliest) first.earliest = o.earliest;
          }
          sorted.push(first);
        }
        sorted.sort((a, b) => b.offerIds.length - a.offerIds.length || +a.earliest - +b.earliest);
      }
      const [keep, ...rest] = sorted;
      const pageList = (c: Cluster) => c.pages.map((p) => `p.${p.pageNumber}`).join(",");
      console.log(
        `\n${product.slug} "${product.name}" — ${sorted.length} clusters, keep ${keep.offerIds.length} offer(s) ` +
          `(${keep.catalogueTitle} ${pageList(keep)} @ ${keep.salePrice ?? "—"})`
      );
      for (const c of rest) {
        console.log(
          `  → split ${c.offerIds.length} offer(s): ${c.catalogueTitle} ${pageList(c)} @ ${c.salePrice ?? "—"}`
        );
      }
      if (!APPLY) continue;

      for (const c of rest) {
        const created = await prisma.product.create({
          data: {
            name: product.name,
            normalizedName: product.normalizedName,
            identityKey: product.identityKey,
            modelNumber: product.modelNumber,
            size: product.size,
            sizeNum: product.sizeNum,
            variant: product.variant,
            coreName: product.coreName,
            brand: product.brand,
            category: product.category,
            subcategory: product.subcategory,
            specifications: product.specifications,
            imageUrl: null,
          },
        });
        const slug = await assignProductSlug(created.id, created.name);
        await prisma.offer.updateMany({
          where: { id: { in: c.offerIds } },
          data: { productId: created.id },
        });
        splits++;

        // Re-crop this cluster's image from its page box (name + price match).
        const imageUrl = await cropClusterImage(prisma, usedBoxes, created.id, product.normalizedName, c);
        if (imageUrl) {
          await prisma.product.update({ where: { id: created.id }, data: { imageUrl } });
          crops++;
        }
      }

      // Kept cluster: drop the old image if it came from a split-off page.
      if (product.imageUrl) {
        const m = product.imageUrl.match(/-page(\d+)\.webp$/);
        const imgPage = m ? parseInt(m[1], 10) : null;
        const keepPages = new Set(
          (await prisma.offer.findMany({ where: { productId, }, select: { cataloguePage: { select: { pageNumber: true } } } })).map(
            (o) => o.cataloguePage.pageNumber
          )
        );
        if (imgPage == null || !keepPages.has(imgPage)) {
          const imageUrl = await cropClusterImage(prisma, usedBoxes, productId, product.normalizedName, keep);
          await prisma.product.update({ where: { id: productId }, data: { imageUrl } });
          if (imageUrl) crops++;
          else console.log(`  ! kept cluster has no attributable image for ${product.slug}`);
        }
      }
    }

    console.log(`\n${APPLY ? "Applied" : "Dry run"}: ${affectedIds.size} products, ${splits} splits, ${crops} images cropped.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function cropClusterImage(
  prisma: PrismaClient,
  usedBoxes: Map<string, Set<number>>,
  productId: string,
  normalizedName: string,
  c: Cluster
): Promise<string | null> {
  const page = await prisma.cataloguePage.findFirst({
    where: { id: { in: c.pages.map((p) => p.pageId) } },
    select: { id: true, imagePath: true, pageNumber: true, aiAnalysis: true, catalogueId: true },
    orderBy: { pageNumber: "asc" },
  });
  // Try each page of the cluster until a name+price box matches.
  const ordered = [
    ...(page ? [page] : []),
    ...((await prisma.cataloguePage.findMany({
      where: { id: { in: c.pages.map((p) => p.pageId).filter((id) => id !== page?.id) } },
      select: { id: true, imagePath: true, pageNumber: true, aiAnalysis: true, catalogueId: true },
      orderBy: { pageNumber: "asc" },
    })) ?? []),
  ];
  for (const pg of ordered) {
    if (!pg.imagePath || !pg.aiAnalysis) continue;
    let entries: { name?: string; salePrice?: number | null; boundingBox?: { x: number; y: number; width: number; height: number } }[];
    try {
      entries = (JSON.parse(pg.aiAnalysis as string) as { products?: typeof entries }).products ?? [];
    } catch {
      continue;
    }
    const used = usedBoxes.get(pg.id) ?? new Set<number>();
    const priceEq = (a: number | null | undefined, b: number | null) =>
      a == null || b == null ? a == b : Math.abs(a - b) < 0.005;

    let idx = entries.findIndex(
      (e, i) =>
        !used.has(i) && e.boundingBox && priceEq(e.salePrice, c.salePrice) &&
        e.name != null && normalizeProductName(e.name) === normalizedName
    );
    if (idx === -1) {
      idx = entries.findIndex((e, i) => !used.has(i) && e.boundingBox && priceEq(e.salePrice, c.salePrice));
    }
    if (idx === -1 || !entries[idx].boundingBox) continue;
    used.add(idx);
    usedBoxes.set(pg.id, used);

    const outputPath = `${dirname(pg.imagePath)}/../products/${productId}-page${pg.pageNumber}.webp`;
    try {
      return await cropProductImage(pg.imagePath, entries[idx].boundingBox!, outputPath, pg.catalogueId);
    } catch (err) {
      console.error(`  crop failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
  return null;
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
