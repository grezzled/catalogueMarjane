import prisma from "@/lib/prisma";
import { cropProductImage } from "@/services/cropping";
import { findMatchingProduct } from "@/services/product-match";
import { createJob, getActiveJobForPage } from "@/services/jobs";
import { dirname } from "path";

export interface BackfillOptions {
  /** Limit to one catalogue; omit to sweep all catalogues. */
  catalogueId?: string;
  /** Count what would be cropped without writing anything. */
  dryRun?: boolean;
  /**
   * Pass 2 (uses AI): enqueue ANALYZE_PAGE jobs for pages that still have
   * products without bounding boxes. Those jobs re-analyze (new mandatory-box
   * prompt) and crop inline on completion. Off by default.
   */
  reanalyzeMissing?: boolean;
}

export interface BackfillResult {
  cataloguesScanned: number;
  pagesScanned: number;
  examined: number;
  cropped: number;
  alreadyHadImage: number;
  skippedNoBox: number;
  skippedNoMatch: number;
  reanalyzeQueued: number;
  reanalyzeAlreadyActive: number;
  dryRun: boolean;
}

export interface BackfillLog {
  step: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message: string;
  timestamp: Date;
}

interface AnalysisProduct {
  name?: string;
  brand?: string | null;
  modelNumber?: string | null;
  features?: string[];
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Sweep pages with stored AI analysis and crop product images that are
 * still missing — using the bounding boxes already in the analysis.
 * No AI calls: pure local image work, safe to run over all catalogues.
 * Idempotent: products that already have an image are skipped.
 */
export async function backfillMissingProductImages(
  opts: BackfillOptions = {},
  onLog?: (log: BackfillLog) => unknown
): Promise<BackfillResult> {
  const result: BackfillResult = {
    cataloguesScanned: 0,
    pagesScanned: 0,
    examined: 0,
    cropped: 0,
    alreadyHadImage: 0,
    skippedNoBox: 0,
    skippedNoMatch: 0,
    reanalyzeQueued: 0,
    reanalyzeAlreadyActive: 0,
    dryRun: opts.dryRun ?? false,
  };

  const addLog = (step: string, status: BackfillLog["status"], message: string) => {
    const log = { step, status, message, timestamp: new Date() };
    if (status === "error") console.error(`[${status.toUpperCase()}] ${step}: ${message}`);
    else console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
    if (onLog) {
      try {
        const r = onLog(log);
        if (r instanceof Promise) r.catch((e) => console.error("onLog error:", e));
      } catch (e) {
        console.error("onLog error:", e);
      }
    }
  };

  const pages = await prisma.cataloguePage.findMany({
    where: {
      ...(opts.catalogueId ? { catalogueId: opts.catalogueId } : {}),
      aiAnalysis: { not: null },
      imagePath: { not: null },
    },
    select: {
      id: true,
      pageNumber: true,
      catalogueId: true,
      imagePath: true,
      aiAnalysis: true,
      catalogue: { select: { title: true } },
    },
    orderBy: [{ catalogueId: "asc" }, { pageNumber: "asc" }],
  });

  addLog(
    "start",
    "in_progress",
    `${result.dryRun ? "Dry run" : "Backfill"}: scanning ${pages.length} analyzed pages` +
      (opts.catalogueId ? " (one catalogue)" : " (all catalogues)")
  );

  let lastCatalogueId: string | null = null;
  // Pages with at least one box-less product → candidates for AI re-analysis.
  const pagesNeedingReanalysis = new Set<string>();

  for (const [i, page] of pages.entries()) {
    if (page.catalogueId !== lastCatalogueId) {
      lastCatalogueId = page.catalogueId;
      result.cataloguesScanned++;
      addLog("catalogue", "in_progress", `Scanning "${page.catalogue.title}"...`);
    }
    result.pagesScanned++;

    let products: AnalysisProduct[];
    try {
      products = (JSON.parse(page.aiAnalysis as string) as { products?: AnalysisProduct[] }).products ?? [];
    } catch {
      addLog("page", "error", `Page ${page.pageNumber}: unreadable analysis, skipping`);
      continue;
    }

    let pageHasBoxless = false;

    for (const product of products) {
      if (!product?.boundingBox || !product.name) {
        result.skippedNoBox++;
        pageHasBoxless = true;
        continue;
      }
      const { match } = await findMatchingProduct({
        name: product.name,
        brand: product.brand,
        modelNumber: product.modelNumber,
        specs: product.features,
      });
      const dbProduct = match
        ? await prisma.product.findUnique({
            where: { id: match.id },
            select: { id: true, imageUrl: true },
          })
        : null;
      if (!dbProduct) {
        result.skippedNoMatch++;
        continue;
      }
      if (dbProduct.imageUrl) {
        result.alreadyHadImage++;
        continue;
      }
      result.examined++;
      if (result.dryRun) {
        result.cropped++;
        continue;
      }
      const outputPath = `${dirname(page.imagePath as string)}/../products/${dbProduct.id}-page${page.pageNumber}.webp`;
      try {
        const cropped = await cropProductImage(
          page.imagePath as string,
          product.boundingBox,
          outputPath,
          page.catalogueId
        );
        if (cropped) {
          await prisma.product.update({
            where: { id: dbProduct.id },
            data: { imageUrl: cropped },
          });
          result.cropped++;
          console.log(`Backfilled image: ${product.name} -> ${cropped}`);
        }
      } catch (cropErr) {
        console.error(`Backfill crop failed for ${product.name}:`, cropErr);
      }
    }

    if (pageHasBoxless) pagesNeedingReanalysis.add(page.id);

    if ((i + 1) % 10 === 0 || i + 1 === pages.length) {
      addLog(
        "page",
        "in_progress",
        `Progress: ${i + 1}/${pages.length} pages, ${result.cropped} cropped`
      );
    }
  }

  // Pass 2 (AI): queue re-analysis for pages with box-less products.
  // Those ANALYZE_PAGE jobs crop inline on completion; a later backfill
  // run then finds the new boxes. Skipped entirely unless requested.
  if (opts.reanalyzeMissing && pagesNeedingReanalysis.size > 0) {
    addLog(
      "reanalyze",
      "in_progress",
      `Queueing AI re-analysis for ${pagesNeedingReanalysis.size} pages without boxes...`
    );
    for (const pageId of pagesNeedingReanalysis) {
      const page = pages.find((p) => p.id === pageId)!;
      const active = await getActiveJobForPage(pageId, "ANALYZE_PAGE");
      if (active) {
        result.reanalyzeAlreadyActive++;
        continue;
      }
      if (!result.dryRun) {
        await createJob(
          "ANALYZE_PAGE",
          { pageId, mode: "full" },
          { catalogueId: page.catalogueId, pageId }
        );
      }
      result.reanalyzeQueued++;
    }
    addLog(
      "reanalyze",
      "completed",
      result.dryRun
        ? `Would queue ${result.reanalyzeQueued} re-analysis jobs (${result.reanalyzeAlreadyActive} already active)`
        : `Queued ${result.reanalyzeQueued} re-analysis jobs (${result.reanalyzeAlreadyActive} already active)`
    );
  }

  addLog(
    "complete",
    "completed",
    `${result.dryRun ? "Dry run" : "Done"}: ${result.cataloguesScanned} catalogues, ` +
      `${result.pagesScanned} pages, ${result.cropped} cropped, ` +
      `${result.alreadyHadImage} already had images, ` +
      `${result.skippedNoBox} without boxes, ${result.skippedNoMatch} unmatched` +
      (opts.reanalyzeMissing
        ? `, ${result.reanalyzeQueued} re-analysis queued`
        : "")
  );
  return result;
}
