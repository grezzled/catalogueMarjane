import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { createJob, getWorkerStatus, type JobType } from "@/services/jobs";

// Maintenance operations allowed through the generic enqueue endpoint.
// Per-resource flows (articles, catalogue processing, page analysis) keep
// their dedicated routes; this is for global ops like the image backfill.
const ALLOWED_TYPES: JobType[] = ["BACKFILL_PRODUCT_IMAGES", "REGENERATE_ORIGINALS"];

interface JobLog {
  step: string;
  status: string;
  message: string;
  timestamp?: string;
}

/** Recent AI jobs feed for the admin worker terminal. */
export async function GET(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(new URL(request.url).searchParams.get("limit") || "15", 10) || 15)
    );

    const jobs = await prisma.aIJob.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        catalogue: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      now: new Date().toISOString(),
      worker: await getWorkerStatus(),
      jobs: jobs.map((job) => {
        let logs: JobLog[] = [];
        let extra: Record<string, unknown> = {};
        try {
          const parsed = job.result ? (JSON.parse(job.result) as Record<string, unknown>) : null;
          if (parsed) {
            const { logs: rawLogs, ...rest } = parsed as { logs?: unknown } & Record<string, unknown>;
            if (Array.isArray(rawLogs)) {
              logs = (rawLogs as JobLog[]).filter(
                (l) => l && typeof l.step === "string" && typeof l.message === "string"
              );
            }
            extra = rest;
          }
        } catch {
          logs = [];
        }
        return {
          jobId: job.id,
          type: job.type,
          catalogue: job.catalogue,
          status: job.status,
          paused: job.paused,
          retryCount: job.retryCount,
          maxRetries: job.maxRetries,
          error: job.errorMessage,
          totalLogs: logs.length,
          // Keep the payload small: only the tail of the log stream.
          logs: logs.slice(-6),
          result: extra,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          updatedAt: job.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const { type, catalogueId, reanalyzeMissing, force } = body as {
      type?: string;
      catalogueId?: string;
      reanalyzeMissing?: boolean;
      force?: boolean;
    };

    if (!type || !ALLOWED_TYPES.includes(type as JobType)) {
      return NextResponse.json(
        { error: `Invalid type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (catalogueId) {
      const catalogue = await prisma.catalogue.findUnique({
        where: { id: catalogueId },
        select: { id: true },
      });
      if (!catalogue) {
        return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
      }
    }

    // Idempotency: reuse the active job instead of queueing duplicates.
    const existing = await prisma.aIJob.findFirst({
      where: {
        type,
        status: { in: ["PENDING", "RETRYING", "PROCESSING"] },
        ...(catalogueId ? { catalogueId } : { catalogueId: null }),
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        queued: false,
        message: "Job already in progress",
        jobId: existing.id,
        type: existing.type,
        status: existing.status,
      });
    }

    const jobId = await createJob(
      type as JobType,
      {
        ...(catalogueId ? { catalogueId } : {}),
        ...(reanalyzeMissing === true ? { reanalyzeMissing: true } : {}),
        ...(force === true ? { force: true } : {}),
      },
      catalogueId ? { catalogueId } : {}
    );
    const job = await prisma.aIJob.findUnique({ where: { id: jobId } });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message: "Job queued — the worker will pick it up",
        jobId: job!.id,
        type: job!.type,
        status: job!.status,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error queueing job:", error);
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }
}
