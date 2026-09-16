import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";

export type JobType =
  | "EXTRACT_PDF_TEXT"
  | "RENDER_PAGE"
  | "ANALYZE_PAGE"
  | "EXTRACT_PRODUCTS"
  | "GENERATE_SUMMARY"
  | "GENERATE_ARTICLE"
  | "GENERATE_EDITORIAL"
  | "GENERATE_SEO"
  | "VALIDATE_ARTICLE"
  | "PROCESS_CATALOGUE"
  | "BACKFILL_PRODUCT_IMAGES"
  | "REGENERATE_ORIGINALS"
  | "GENERATE_SITEMAP";

export async function createJob(
  type: JobType,
  payload: Record<string, unknown>,
  options?: { catalogueId?: string; pageId?: string; priority?: number }
): Promise<string> {
  const job = await prisma.aIJob.create({
    data: {
      id: uuid(),
      type,
      catalogueId: options?.catalogueId,
      pageId: options?.pageId,
      payload: JSON.stringify(payload),
      priority: options?.priority || 0,
      status: "PENDING",
    },
  });
  return job.id;
}

export async function createJobsForCatalogue(
  catalogueId: string,
  types: JobType[]
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const type of types) {
    const jobId = await createJob(
      type,
      { catalogueId },
      { catalogueId, priority: types.indexOf(type) }
    );
    jobIds.push(jobId);
  }

  return jobIds;
}

export async function getNextJob(): Promise<{
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  catalogueId: string | null;
  pageId: string | null;
} | null> {
  const job = await prisma.aIJob.findFirst({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      paused: false,
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  if (!job) return null;

  await prisma.aIJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  return {
    id: job.id,
    type: job.type as JobType,
    payload: job.payload ? JSON.parse(job.payload as string) : {},
    catalogueId: job.catalogueId,
    pageId: job.pageId,
  };
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      result: JSON.stringify(result),
      completedAt: new Date(),
    },
  });
}

export async function failJob(
  jobId: string,
  error: string,
  opts?: { retry?: boolean }
): Promise<void> {
  const job = await prisma.aIJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const retryCount = job.retryCount + 1;
  const maxRetries = job.maxRetries;

  // Permanent errors (bad payload, unknown type) skip the retry loop.
  if (opts?.retry === false) {
    await prisma.aIJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: error, retryCount },
    });
    return;
  }

  if (retryCount < maxRetries) {
    const backoffMs = Math.pow(2, retryCount) * 1000;
    await prisma.aIJob.update({
      where: { id: jobId },
      data: {
        status: "RETRYING",
        errorMessage: error,
        retryCount,
        nextRetryAt: new Date(Date.now() + backoffMs),
      },
    });
  } else {
    await prisma.aIJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: error,
        retryCount,
      },
    });
  }
}

const ACTIVE_JOB_STATUSES = ["PENDING", "RETRYING", "PROCESSING"];

/** Latest non-terminal job for a catalogue+type — used for idempotency. */
export async function getActiveJobForCatalogue(
  catalogueId: string,
  type: JobType
) {
  return prisma.aIJob.findFirst({
    where: {
      catalogueId,
      type,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Latest non-terminal job for a page+type — used for idempotency. */
export async function getActiveJobForPage(pageId: string, type: JobType) {
  return prisma.aIJob.findFirst({
    where: {
      pageId,
      type,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Global worker kill-switch. When true the worker claims nothing. */
export async function isWorkerPaused(): Promise<boolean> {
  const settings = await prisma.workerSettings.findUnique({
    where: { id: "singleton" },
    select: { paused: true },
  });
  return settings?.paused ?? false;
}

export async function setWorkerPaused(paused: boolean): Promise<void> {
  await prisma.workerSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", paused },
    update: { paused },
  });
}

export interface WorkerStatus {
  paused: boolean;
  pending: number;
  processing: number;
  retrying: number;
  pausedJobs: number;
  completed: number;
  failed: number;
}

export async function getWorkerStatus(): Promise<WorkerStatus> {
  const [paused, pending, processing, retrying, pausedJobs, completed, failed] = await Promise.all([
    isWorkerPaused(),
    prisma.aIJob.count({ where: { status: "PENDING", paused: false } }),
    prisma.aIJob.count({ where: { status: "PROCESSING" } }),
    prisma.aIJob.count({ where: { status: "RETRYING", paused: false } }),
    prisma.aIJob.count({ where: { paused: true, status: { in: ACTIVE_JOB_STATUSES } } }),
    prisma.aIJob.count({ where: { status: "COMPLETED" } }),
    prisma.aIJob.count({ where: { status: "FAILED" } }),
  ]);
  return { paused, pending, processing, retrying, pausedJobs, completed, failed };
}

/** Pause all queued jobs (PENDING + RETRYING). Running jobs finish. */
export async function pauseAllJobs(onlyPending = false): Promise<number> {
  const res = await prisma.aIJob.updateMany({
    where: {
      status: { in: onlyPending ? ["PENDING"] : ["PENDING", "RETRYING"] },
      paused: false,
    },
    data: { paused: true },
  });
  return res.count;
}

/** Resume all paused jobs; backoff timers are cleared so they run ASAP. */
export async function resumeAllJobs(): Promise<number> {
  await prisma.aIJob.updateMany({
    where: { paused: true, status: "RETRYING" },
    data: { paused: false, nextRetryAt: null },
  });
  const res = await prisma.aIJob.updateMany({
    where: { paused: true },
    data: { paused: false },
  });
  return res.count;
}

export async function pauseJob(jobId: string): Promise<boolean> {
  const res = await prisma.aIJob.updateMany({
    where: { id: jobId, status: { in: ACTIVE_JOB_STATUSES }, paused: false },
    data: { paused: true },
  });
  return res.count > 0;
}

export async function resumeJob(jobId: string): Promise<boolean> {
  const job = await prisma.aIJob.findUnique({
    where: { id: jobId },
    select: { status: true, paused: true },
  });
  if (!job || !job.paused) return false;
  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      paused: false,
      ...(job.status === "RETRYING" ? { nextRetryAt: new Date() } : {}),
    },
  });
  return true;
}

/**
 * Recover jobs stuck in PROCESSING (worker crashed / was killed).
 * Returns the number of jobs reset.
 */
export async function recoverStaleJobs(staleAfterMs = 15 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const stale = await prisma.aIJob.findMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: cutoff },
    },
    select: { id: true, retryCount: true, maxRetries: true },
  });

  for (const job of stale) {
    if (job.retryCount + 1 < job.maxRetries) {
      await prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: "RETRYING",
          errorMessage: "Worker restarted while job was processing",
          retryCount: job.retryCount + 1,
          nextRetryAt: new Date(),
        },
      });
    } else {
      await prisma.aIJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: "Worker restarted while job was processing",
        },
      });
    }
  }

  return stale.length;
}
