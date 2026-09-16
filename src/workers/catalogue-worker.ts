import { prisma } from "@/lib/prisma";
import { extractPDFText, renderPDFPages, resolvePdfPath } from "@/services/pdf";
import { processCatalogue } from "@/services/processing";
import { generateArticleForCatalogue } from "@/services/articles";
import { generateEditorialForCatalogue } from "@/services/editorial";
import { analyzePageFull, fillMissingPageCrops } from "@/services/page-analysis";
import { backfillMissingProductImages } from "@/services/backfill";
import { regenerateOriginals } from "@/services/originals";
import { ensureCategoriesExist } from "@/services/categories";
import {
  completeJob,
  createJob,
  failJob,
  getActiveJobForCatalogue,
  getNextJob,
  isWorkerPaused,
  recoverStaleJobs,
} from "@/services/jobs";
import { readFile } from "fs/promises";
import { writeSitemapFile } from "@/services/sitemap-file";

// Articles stay live this long after their catalogue ends before auto-expiry.
const ARTICLE_EXPIRY_GRACE_DAYS = 7;

export async function processNextAIJob(): Promise<boolean> {
  const job = await getNextJob();
  if (!job) return false;

  console.log(`Processing AI job ${job.id} (${job.type})`);

  try {
    switch (job.type) {
      case "GENERATE_ARTICLE": {
        const catalogueId =
          job.catalogueId ?? (job.payload.catalogueId as string | undefined);
        if (!catalogueId) {
          await failJob(job.id, "Missing catalogueId in job payload", { retry: false });
          break;
        }
        // Stream step logs into the job record so they're visible via
        // GET /api/jobs/[id] no matter where the worker process runs.
        const stepLogs: Array<{ step: string; status: string; message: string; timestamp: string }> = [];
        const persistLogs = () =>
          prisma.aIJob
            .update({
              where: { id: job.id },
              data: { result: JSON.stringify({ logs: stepLogs }) },
            })
            .catch((e) => console.error(`Failed to persist logs for job ${job.id}:`, e));
        const result = await generateArticleForCatalogue(catalogueId, {
          articleType: job.payload.articleType as string | undefined,
          category: job.payload.category as string | undefined,
          onLog: (log) => {
            stepLogs.push({
              step: log.step,
              status: log.status,
              message: log.message,
              timestamp: log.timestamp.toISOString(),
            });
            return persistLogs();
          },
        });
        if (result.success) {
          await completeJob(job.id, {
            articleId: result.articleId ?? null,
            articleSlug: result.articleSlug ?? null,
            logs: stepLogs,
          });
          console.log(`AI job ${job.id} completed (article ${result.articleId})`);
        } else {
          await persistLogs();
          await failJob(job.id, result.error || "Article generation failed");
          console.error(`AI job ${job.id} failed: ${result.error}`);
        }
        break;
      }
      case "GENERATE_EDITORIAL": {
        const catalogueId =
          job.catalogueId ?? (job.payload.catalogueId as string | undefined);
        if (!catalogueId) {
          await failJob(job.id, "Missing catalogueId in job payload", { retry: false });
          break;
        }
        // Short single AI call (2 attempts max); the text is verified
        // against DB facts before saving, so nothing ungrounded is stored.
        // No step-log streaming: the service is one atomic AI call.
        // Public page refresh is handled by the admin UI via
        // POST /api/revalidate once the job completes.
        const result = await generateEditorialForCatalogue(catalogueId);
        if (result.success) {
          await completeJob(job.id, {
            text: result.text ?? null,
            checks: result.checks ?? null,
          });
          console.log(`AI job ${job.id} completed (editorial for catalogue ${catalogueId})`);
        } else {
          await failJob(job.id, result.error || "Editorial generation failed");
          console.error(`AI job ${job.id} failed: ${result.error}`);
        }
        break;
      }
      case "PROCESS_CATALOGUE": {
        const catalogueId =
          job.catalogueId ?? (job.payload.catalogueId as string | undefined);
        if (!catalogueId) {
          await failJob(job.id, "Missing catalogueId in job payload", { retry: false });
          break;
        }
        // Same log-streaming pattern as GENERATE_ARTICLE.
        const stepLogs: Array<{ step: string; status: string; message: string; timestamp: string }> = [];
        const persistLogs = () =>
          prisma.aIJob
            .update({
              where: { id: job.id },
              data: { result: JSON.stringify({ logs: stepLogs }) },
            })
            .catch((e) => console.error(`Failed to persist logs for job ${job.id}:`, e));
        try {
          await processCatalogue(catalogueId, (log) => {
            stepLogs.push({
              step: log.step,
              status: log.status,
              message: log.message,
              timestamp: log.timestamp.toISOString(),
            });
            return persistLogs();
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          await persistLogs();
          await failJob(job.id, message);
          console.error(`AI job ${job.id} threw: ${message}`);
          break;
        }
        // processCatalogue never throws for quota exhaustion — it marks the
        // catalogue FAILED and returns. Mirror that onto the job (retryable:
        // keys may recover by the next attempt).
        const catalogue = await prisma.catalogue.findUnique({
          where: { id: catalogueId },
          select: { status: true, errorMessage: true, processedPages: true, productCount: true, offerCount: true },
        });
        if (!catalogue) {
          await failJob(job.id, "Catalogue deleted while processing", { retry: false });
        } else if (catalogue.status === "FAILED") {
          await persistLogs();
          await failJob(job.id, catalogue.errorMessage || "Catalogue processing failed");
        } else {
          const pages = await prisma.cataloguePage.findMany({
            where: { catalogueId },
            select: { category: true },
          });
          const cats = [...new Set(pages.map((p) => p.category).filter(Boolean))] as string[];
          if (cats.length > 0) {
            await ensureCategoriesExist(cats);
            console.log(`Ensured ${cats.length} categories exist`);
          }
          await completeJob(job.id, {
            processedPages: catalogue.processedPages,
            productCount: catalogue.productCount,
            offerCount: catalogue.offerCount,
            logs: stepLogs,
          });
          console.log(`AI job ${job.id} completed (catalogue ${catalogueId})`);
        }
        break;
      }
      case "ANALYZE_PAGE":
        await processAnalyzePageJob(job);
        break;
      case "REGENERATE_ORIGINALS": {
        const catalogueId =
          job.catalogueId ?? (job.payload.catalogueId as string | undefined);
        const force = job.payload.force === true;
        const stepLogs: Array<{ step: string; status: string; message: string; timestamp: string }> = [];
        const persistLogs = () =>
          prisma.aIJob
            .update({
              where: { id: job.id },
              data: { result: JSON.stringify({ logs: stepLogs }) },
            })
            .catch((e) => console.error(`Failed to persist logs for job ${job.id}:`, e));
        try {
          const result = await regenerateOriginals(
            catalogueId ? { catalogueId, force } : { force },
            (log) => {
              stepLogs.push({
                step: log.step,
                status: log.status,
                message: log.message,
                timestamp: log.timestamp.toISOString(),
              });
              return persistLogs();
            }
          );
          await completeJob(job.id, { ...result, logs: stepLogs });
          console.log(`AI job ${job.id} completed (originals: ${result.regenerated} regenerated)`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          await persistLogs();
          await failJob(job.id, message);
          console.error(`AI job ${job.id} threw: ${message}`);
        }
        break;
      }
      case "BACKFILL_PRODUCT_IMAGES": {
        const catalogueId =
          job.catalogueId ?? (job.payload.catalogueId as string | undefined);
        const reanalyzeMissing = job.payload.reanalyzeMissing === true;
        const stepLogs: Array<{ step: string; status: string; message: string; timestamp: string }> = [];
        const persistLogs = () =>
          prisma.aIJob
            .update({
              where: { id: job.id },
              data: { result: JSON.stringify({ logs: stepLogs }) },
            })
            .catch((e) => console.error(`Failed to persist logs for job ${job.id}:`, e));
        try {
          const result = await backfillMissingProductImages(
            catalogueId ? { catalogueId, reanalyzeMissing } : { reanalyzeMissing },
            (log) => {
              stepLogs.push({
                step: log.step,
                status: log.status,
                message: log.message,
                timestamp: log.timestamp.toISOString(),
              });
              return persistLogs();
            }
          );
          await completeJob(job.id, { ...result, logs: stepLogs });
          console.log(`AI job ${job.id} completed (backfilled ${result.cropped} images)`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          await persistLogs();
          await failJob(job.id, message);
          console.error(`AI job ${job.id} threw: ${message}`);
        }
        break;
      }
      default:
        await failJob(job.id, `Unknown job type: ${job.type}`, { retry: false });
        console.error(`AI job ${job.id} has unknown type ${job.type}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await failJob(job.id, message);
    console.error(`AI job ${job.id} threw: ${message}`);
  }

  return true;
}

async function processAnalyzePageJob(job: {
  id: string;
  pageId: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  const pageId = job.pageId ?? (job.payload.pageId as string | undefined);
  if (!pageId) {
    await failJob(job.id, "Missing pageId in job payload", { retry: false });
    return;
  }
  const mode = job.payload.mode === "crops-only" ? "crops-only" : "full";
  const stepLogs: Array<{ step: string; status: string; message: string; timestamp: string }> = [];
  const persistLogs = () =>
    prisma.aIJob
      .update({
        where: { id: job.id },
        data: { result: JSON.stringify({ logs: stepLogs }) },
      })
      .catch((e) => console.error(`Failed to persist logs for job ${job.id}:`, e));
  const onLog = (log: { step: string; status: string; message: string; timestamp: Date }) => {
    stepLogs.push({
      step: log.step,
      status: log.status,
      message: log.message,
      timestamp: log.timestamp.toISOString(),
    });
    return persistLogs();
  };
  try {
    if (mode === "crops-only") {
      const result = await fillMissingPageCrops(pageId, onLog);
      await completeJob(job.id, { ...result, logs: stepLogs });
    } else {
      const result = await analyzePageFull(pageId, onLog);
      await completeJob(job.id, { ...result, logs: stepLogs });
    }
    console.log(`AI job ${job.id} completed (page ${pageId}, ${mode})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await persistLogs();
    await failJob(job.id, message);
    console.error(`AI job ${job.id} threw: ${message}`);
  }
}

async function runWorker() {
  console.log("Worker started. Listening for jobs...");
  let lastRecovery = 0;
  let lastExpiryCheck = 0;
  let wasPaused = false;

  while (true) {
    try {
      // Global kill-switch: while paused the worker claims nothing.
      if (await isWorkerPaused()) {
        if (!wasPaused) {
          wasPaused = true;
          console.log("Worker paused — waiting for resume...");
        }
        await sleep(5000);
        continue;
      }
      wasPaused = false;

      // Recover jobs orphaned by a previous worker crash (at most once a minute)
      if (Date.now() - lastRecovery > 60 * 1000) {
        lastRecovery = Date.now();
        const recovered = await recoverStaleJobs();
        if (recovered > 0) console.log(`Recovered ${recovered} stale AI job(s)`);
      }

      // Expire articles of long-ended catalogues (at most once an hour).
      // Public pages only serve PUBLISHED articles, so EXPIRED ones drop out
      // automatically (ISR picks it up within the hour).
      // public/sitemap.xml is rewritten here too, so it stays fresh with
      // no Next.js rebuild and no running Next.js server — just DB access.
      if (Date.now() - lastExpiryCheck > 60 * 60 * 1000) {
        lastExpiryCheck = Date.now();
        try {
          const cutoff = new Date(Date.now() - ARTICLE_EXPIRY_GRACE_DAYS * 24 * 60 * 60 * 1000);
          const expired = await prisma.article.updateMany({
            where: {
              status: "PUBLISHED",
              catalogue: { endDate: { lt: cutoff } },
            },
            data: { status: "EXPIRED", publishedAt: null },
          });
          if (expired.count > 0) {
            console.log(`Expired ${expired.count} article(s) of ended catalogues`);
          }
          const { urlCount } = await writeSitemapFile(prisma);
          console.log(`Sitemap refreshed (${urlCount} URLs)`);
        } catch (error) {
          console.error("Article expiry check error:", error);
        }
      }

      // Drain one AI job per iteration (retries + backoff handled by jobs service;
      // individually paused jobs are skipped by getNextJob)
      try {
        await processNextAIJob();
      } catch (error) {
        console.error("AI job dispatch error:", error);
      }

      const catalogue = await prisma.catalogue.findFirst({
        where: {
          status: { in: ["UPLOADED", "PROCESSING", "EXTRACTING"] },
          paused: false,
        },
        orderBy: { createdAt: "asc" },
      });

      if (!catalogue) {
        await sleep(5000);
        continue;
      }

      console.log(`Processing catalogue: ${catalogue.title}`);

      if (catalogue.status === "UPLOADED" && catalogue.pdfPath) {
        await prisma.catalogue.update({
          where: { id: catalogue.id },
          data: { status: "EXTRACTING" },
        });

        const resolvedPdf = await resolvePdfPath(catalogue.pdfPath);
        if (!resolvedPdf) {
          throw new Error(`PDF not found on disk for catalogue ${catalogue.id}`);
        }
        const pdfBuffer = await readFile(resolvedPdf);
        const extraction = await extractPDFText(pdfBuffer);

        await prisma.catalogue.update({
          where: { id: catalogue.id },
          data: { pageCount: extraction.pageCount, status: "PROCESSING" },
        });

        for (const page of extraction.pages) {
          await prisma.cataloguePage.create({
            data: {
              catalogueId: catalogue.id,
              pageNumber: page.pageNumber,
              extractedText: page.text,
              status: "PENDING",
            },
          });
        }

        try {
          const pageImages = await renderPDFPages(
            pdfBuffer,
            catalogue.id,
            extraction.pageCount
          );
          for (const pi of pageImages) {
            await prisma.cataloguePage.updateMany({
              where: { catalogueId: catalogue.id, pageNumber: pi.pageNumber },
              data: { imagePath: pi.imagePath },
            });
          }
        } catch (err) {
          console.warn("Could not render page images:", err);
        }

        console.log(`Extracted ${extraction.pageCount} pages`);
      }

      if (
        catalogue.status === "PROCESSING" ||
        catalogue.status === "EXTRACTING"
      ) {
        // AI analysis always runs as a PROCESS_CATALOGUE job (visible in the
        // admin terminal, retried with backoff) — never inline.
        const active = await getActiveJobForCatalogue(catalogue.id, "PROCESS_CATALOGUE");
        if (active) {
          console.log(`Catalogue ${catalogue.title} already has ${active.status} job ${active.id}`);
        } else {
          const jobId = await createJob(
            "PROCESS_CATALOGUE",
            { catalogueId: catalogue.id },
            { catalogueId: catalogue.id }
          );
          console.log(`Queued PROCESS_CATALOGUE job ${jobId} for ${catalogue.title}`);
        }
      }

      await sleep(2000);
    } catch (error) {
      console.error("Worker error:", error);
      await sleep(10000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Only auto-run when executed directly (`npm run worker`), not when imported.
if (process.argv[1]?.endsWith("catalogue-worker.ts")) {
  runWorker();
}