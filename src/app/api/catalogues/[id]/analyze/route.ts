import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createJob, getActiveJobForCatalogue } from "@/services/jobs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
      include: { pages: true },
    });

    if (!catalogue) {
      return NextResponse.json(
        { error: "Catalogue not found" },
        { status: 404 }
      );
    }

    if (catalogue.pages.length === 0) {
      return NextResponse.json(
        { error: "No pages to process. Run extraction first." },
        { status: 400 }
      );
    }

    // All AI work runs on the worker queue.
    const existing = await getActiveJobForCatalogue(id, "PROCESS_CATALOGUE");
    if (existing) {
      return NextResponse.json({
        success: true,
        queued: false,
        message: "Processing already in progress",
        jobId: existing.id,
        status: existing.status,
      });
    }

    const jobId = await createJob(
      "PROCESS_CATALOGUE",
      { catalogueId: id },
      { catalogueId: id }
    );

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message: "Processing queued — the worker will pick it up",
        jobId,
        status: "PENDING",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error starting analysis:", error);
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 }
    );
  }
}
