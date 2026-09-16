import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { createJob, getActiveJobForCatalogue } from "@/services/jobs";

function toJobResponse(job: {
  id: string;
  type: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  result: string | null;
  createdAt: Date;
}) {
  let result: Record<string, unknown> | null = null;
  try {
    result = job.result ? (JSON.parse(job.result) as Record<string, unknown>) : null;
  } catch {
    result = null;
  }
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    error: job.errorMessage,
    result,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await params;

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
    });

    if (!catalogue) {
      return NextResponse.json(
        { error: "Catalogue not found" },
        { status: 404 }
      );
    }

    // All AI work runs on the worker queue — no synchronous fallback.
    // Idempotency: reuse the active job instead of queueing duplicates.
    const existing = await getActiveJobForCatalogue(id, "GENERATE_EDITORIAL");
    if (existing) {
      return NextResponse.json({
        success: true,
        queued: false,
        message: "Editorial generation already in progress",
        ...toJobResponse(existing),
      });
    }

    const jobId = await createJob(
      "GENERATE_EDITORIAL",
      { catalogueId: id },
      { catalogueId: id }
    );
    const job = await prisma.aIJob.findUnique({ where: { id: jobId } });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message: "Editorial generation queued — the worker will pick it up",
        ...toJobResponse(job!),
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error queueing editorial generation:", error);
    return NextResponse.json(
      { error: "Failed to queue editorial generation" },
      { status: 500 }
    );
  }
}
