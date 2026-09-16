import prisma from "@/lib/prisma";
import { renderPDFPages, resolvePdfPath } from "@/services/pdf";
import fs from "fs/promises";
import path from "path";

export interface OriginalsOptions {
  /** Limit to one catalogue; omit to sweep all catalogues. */
  catalogueId?: string;
  /** Re-render even when originals already exist. */
  force?: boolean;
  /** Probe and count only — no rendering. */
  dryRun?: boolean;
}

export interface OriginalsResult {
  cataloguesScanned: number;
  regenerated: number;
  skippedExisting: number;
  skippedNoPdf: number;
  skippedNoPages: number;
  failed: number;
  dryRun: boolean;
}

export interface OriginalsLog {
  step: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message: string;
  timestamp: Date;
}

export function originalProbePath(catalogueId: string): string {
  return path.join(
    process.env.UPLOAD_DIR_ORIGINAL || "./uploads-original",
    catalogueId,
    "pages",
    "page-01.jpg"
  );
}

export async function hasOriginals(catalogueId: string): Promise<boolean> {
  try {
    await fs.access(originalProbePath(catalogueId));
    return true;
  } catch {
    return false;
  }
}

/**
 * (Re)generate the 200-DPI original page JPEGs from the stored catalogue PDFs.
 * These are what AI analysis prefers (see imageToBase64) — without them every
 * AI call silently falls back to the WebP display images.
 * No AI calls. Idempotent unless force=true.
 */
export async function regenerateOriginals(
  opts: OriginalsOptions = {},
  onLog?: (log: OriginalsLog) => unknown
): Promise<OriginalsResult> {
  const result: OriginalsResult = {
    cataloguesScanned: 0,
    regenerated: 0,
    skippedExisting: 0,
    skippedNoPdf: 0,
    skippedNoPages: 0,
    failed: 0,
    dryRun: opts.dryRun ?? false,
  };

  const addLog = (step: string, status: OriginalsLog["status"], message: string) => {
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

  const catalogues = await prisma.catalogue.findMany({
    where: opts.catalogueId ? { id: opts.catalogueId } : {},
    select: { id: true, title: true, pdfPath: true, pageCount: true },
    orderBy: { createdAt: "asc" },
  });

  addLog(
    "start",
    "in_progress",
    `${result.dryRun ? "Dry run" : "Regenerating originals"}: scanning ${catalogues.length} catalogue(s)` +
      (opts.force ? " (forced)" : "")
  );

  for (const catalogue of catalogues) {
    result.cataloguesScanned++;

    // Stored pdfPaths predate the move of UPLOAD_DIR under ./public —
    // resolvePdfPath tries both locations.
    const pdfPath = await resolvePdfPath(catalogue.pdfPath);
    if (!pdfPath) {
      result.skippedNoPdf++;
      addLog("catalogue", "error", `"${catalogue.title}": PDF missing on disk, skipping`);
      continue;
    }
    if (!catalogue.pageCount || catalogue.pageCount <= 0) {
      result.skippedNoPages++;
      addLog("catalogue", "error", `"${catalogue.title}": pageCount is 0, skipping`);
      continue;
    }
    if (!opts.force && !opts.dryRun && (await hasOriginals(catalogue.id))) {
      result.skippedExisting++;
      continue;
    }
    if (opts.dryRun) {
      const exists = await hasOriginals(catalogue.id);
      if (exists && !opts.force) result.skippedExisting++;
      else result.regenerated++;
      continue;
    }

    addLog(
      "render",
      "in_progress",
      `"${catalogue.title}": rendering ${catalogue.pageCount} pages at 200 DPI...`
    );
    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      const rendered = await renderPDFPages(pdfBuffer, catalogue.id, catalogue.pageCount);
      // renderPDFPages only lists pages whose original JPEG exists on disk.
      if (rendered.length === 0) throw new Error("pdftoppm produced no pages");
      result.regenerated++;
      addLog(
        "render",
        "completed",
        `"${catalogue.title}": ${rendered.length}/${catalogue.pageCount} originals ready`
      );
    } catch (error) {
      result.failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      addLog("render", "error", `"${catalogue.title}" failed: ${message}`.slice(0, 200));
    }
  }

  addLog(
    "complete",
    "completed",
    `${result.dryRun ? "Dry run" : "Done"}: ${result.cataloguesScanned} scanned, ` +
      `${result.regenerated} ${result.dryRun ? "would render" : "regenerated"}, ` +
      `${result.skippedExisting} already present, ${result.skippedNoPdf} without PDF, ` +
      `${result.skippedNoPages} without pages, ${result.failed} failed`
  );
  return result;
}
