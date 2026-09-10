import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";
import { processCatalogue } from "@/services/processing";
import { generateArticleForCatalogue } from "@/services/articles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
          processCatalogue(id).catch((err) => {
            console.error("Resume processing error:", err);
          });
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
        return NextResponse.json({ success: true, message: "Catalogue cancelled" });

      case "remove":
        await prisma.article.deleteMany({ where: { catalogueId: id } });
        await prisma.aIJob.deleteMany({ where: { catalogueId: id } });
        await prisma.offer.deleteMany({ where: { catalogueId: id } });
        await prisma.cataloguePage.deleteMany({ where: { catalogueId: id } });
        await prisma.catalogue.delete({ where: { id } });
        const uploadDir = path.join(process.cwd(), "uploads", id);
        await unlink(uploadDir).catch(() => {});
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
        processCatalogue(id).catch((err) => {
          console.error("Reset processing error:", err);
        });
        return NextResponse.json({ success: true, message: "Catalogue reset" });

      case "start":
        processCatalogue(id).catch((err) => {
          console.error("Start processing error:", err);
        });
        return NextResponse.json({ success: true, message: "Processing started" });

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