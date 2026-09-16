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
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { pageId } = await params;

    const page = await prisma.cataloguePage.findUnique({
      where: { id: pageId },
      select: { id: true, catalogueId: true, imagePath: true },
    });

    if (!page || !page.imagePath) {
      return NextResponse.json({ error: "Page not found or no image" }, { status: 404 });
    }

    // All AI work runs on the worker queue — no synchronous fallback.
    // Idempotency: reuse the active job instead of queueing duplicates.
    const existing = await getActiveJobForPage(pageId, "ANALYZE_PAGE");
    if (existing) {
      return NextResponse.json({
        success: true,
        queued: false,
        message: "Page job already in progress",
        ...toJobResponse(existing),
      });
    }

    const jobId = await createJob(
      "ANALYZE_PAGE",
      { pageId, mode: "crops-only" },
      { catalogueId: page.catalogueId, pageId }
    );
    const job = await prisma.aIJob.findUnique({ where: { id: jobId } });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message: "Cropping queued — the worker will pick it up",
        ...toJobResponse(job!),
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Crop images error:", error);
    return NextResponse.json({ error: "Failed to crop images" }, { status: 500 });
  }
}
