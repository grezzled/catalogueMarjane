import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { rm } from "fs/promises";
import path from "path";
import { createJob, getActiveJobForCatalogue } from "@/services/jobs";
import { revalidateSite } from "@/lib/revalidate";

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

/**
 * Queue a PROCESS_CATALOGUE job (idempotent). All AI work runs on the
 * worker queue — there is intentionally no synchronous fallback.
 */
async function enqueueProcessing(id: string, message: string) {
  const existing = await getActiveJobForCatalogue(id, "PROCESS_CATALOGUE");
  if (existing) {
    return NextResponse.json({
      success: true,
      queued: false,
      message: "Processing already in progress",
      ...toJobResponse(existing),
    });
  }

  const jobId = await createJob(
    "PROCESS_CATALOGUE",
    { catalogueId: id },
    { catalogueId: id }
  );
  const job = await prisma.aIJob.findUnique({ where: { id: jobId } });
  return NextResponse.json(
    {
      success: true,
      queued: true,
      message: `${message} — worker will pick it up`,
      ...toJobResponse(job!),
    },
    { status: 202 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const catalogue = await prisma.catalogue.findUnique({ where: { id } });
    if (!catalogue) {
      return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
    }

    switch (action) {
      case "pause":
        if (catalogue.paused) {
          return NextResponse.json({ error: "Already paused" }, { status: 400 });
        }
        await prisma.catalogue.update({
          where: { id },
          data: { paused: true },
        });
        return NextResponse.json({ success: true, message: "Catalogue paused" });

      case "resume":
        if (!catalogue.paused && catalogue.status !== "FAILED") {
          return NextResponse.json({ error: "Not paused" }, { status: 400 });
        }
        await prisma.cataloguePage.updateMany({
          where: { catalogueId: id, status: "FAILED" },
          data: { status: "PENDING" },
        });
        await prisma.catalogue.update({
          where: { id },
          data: { paused: false, errorMessage: null },
        });
        if (["PROCESSING", "EXTRACTING", "ANALYZING", "FAILED"].includes(catalogue.status)) {
          return enqueueProcessing(id, "Catalogue resumed");
        }
        return NextResponse.json({ success: true, message: "Catalogue resumed" });

      case "restart":
        await prisma.cataloguePage.deleteMany({ where: { catalogueId: id } });
        await prisma.offer.deleteMany({ where: { catalogueId: id } });
        await prisma.catalogue.update({
          where: { id },
          data: {
            status: "UPLOADED",
            paused: false,
            processedPages: 0,
            productCount: 0,
            offerCount: 0,
            articleCount: 0,
            aiProcessingProgress: 0,
            errorMessage: null,
          },
        });
        return NextResponse.json({ success: true, message: "Catalogue restarted" });

      case "cancel":
        await prisma.catalogue.update({
          where: { id },
          data: { status: "CANCELLED", paused: false },
        });
        // Visibility-changing: the catalogue drops out of public listings.
        revalidateSite();
        return NextResponse.json({ success: true, message: "Catalogue cancelled" });

      case "remove":
        await prisma.article.deleteMany({ where: { catalogueId: id } });
        await prisma.aIJob.deleteMany({ where: { catalogueId: id } });
        await prisma.offer.deleteMany({ where: { catalogueId: id } });
        await prisma.cataloguePage.deleteMany({ where: { catalogueId: id } });
        await prisma.catalogue.delete({ where: { id } });
        const uploadDir = path.join(process.env.UPLOAD_DIR || "./public/uploads", id);
        await rm(uploadDir, { recursive: true, force: true }).catch(() => {});
        revalidateSite();
        return NextResponse.json({ success: true, message: "Catalogue removed" });

      case "reset":
        await prisma.offer.deleteMany({ where: { catalogueId: id } });
        await prisma.article.deleteMany({ where: { catalogueId: id } });
        await prisma.aIJob.deleteMany({ where: { catalogueId: id } });
        await prisma.cataloguePage.updateMany({
          where: { catalogueId: id },
          data: {
            aiAnalysis: null,
            pageType: null,
            category: null,
            productCount: 0,
            status: "PENDING",
            aiModel: null,
            confidence: null,
            processedAt: null,
          },
        });
        await prisma.catalogue.update({
          where: { id },
          data: {
            status: "PROCESSING",
            paused: false,
            processedPages: 0,
            productCount: 0,
            offerCount: 0,
            articleCount: 0,
            aiProcessingProgress: 0,
            errorMessage: null,
          },
        });
        // Visibility-changing: the catalogue drops out of public listings.
        revalidateSite();
        return enqueueProcessing(id, "Catalogue reset");

      case "start":
        return enqueueProcessing(id, "Processing started");

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Control error:", error);
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    );
  }
}
