import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { createJob, getActiveJobForPage } from "@/services/jobs";

function toJobResponse(job: {
  id: string;
  type: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
}) {
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    error: job.errorMessage,
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

    const page = await prisma.cataloguePage.findUnique({
      where: { id },
      select: { id: true, catalogueId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // All AI work runs on the worker queue — no synchronous fallback.
    // Idempotency: reuse the active job instead of queueing duplicates.
    const existing = await getActiveJobForPage(id, "ANALYZE_PAGE");
    if (existing) {
      return NextResponse.json({
        success: true,
        queued: false,
        message: "Page analysis already in progress",
        ...toJobResponse(existing),
      });
    }

    const jobId = await createJob(
      "ANALYZE_PAGE",
      { pageId: id, mode: "full" },
      { catalogueId: page.catalogueId, pageId: id }
    );
    const job = await prisma.aIJob.findUnique({ where: { id: jobId } });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message: "Page analysis queued — the worker will pick it up",
        ...toJobResponse(job!),
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Page analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze page" },
      { status: 500 }
    );
  }
}
