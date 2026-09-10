import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";

export type JobType =
  | "EXTRACT_PDF_TEXT"
  | "RENDER_PAGE"
  | "ANALYZE_PAGE"
  | "EXTRACT_PRODUCTS"
  | "GENERATE_SUMMARY"
  | "GENERATE_ARTICLE"
  | "GENERATE_SEO"
  | "VALIDATE_ARTICLE"
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
  error: string
): Promise<void> {
  const job = await prisma.aIJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const retryCount = job.retryCount + 1;
  const maxRetries = job.maxRetries;

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
