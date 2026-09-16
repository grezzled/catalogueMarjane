import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.aIJob.findUnique({ where: { id } });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let result: Record<string, unknown> | null = null;
    try {
      result = job.result ? (JSON.parse(job.result) as Record<string, unknown>) : null;
    } catch {
      result = null;
    }

    return NextResponse.json({
      jobId: job.id,
      type: job.type,
      catalogueId: job.catalogueId,
      status: job.status,
      paused: job.paused,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      error: job.errorMessage,
      result,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}
