import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { extractPDFText, renderPDFPages } from "@/services/pdf";
import { readFile } from "fs/promises";

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

    if (!catalogue.pdfPath) {
      return NextResponse.json(
        { error: "No PDF file found" },
        { status: 400 }
      );
    }

    await prisma.catalogue.update({
      where: { id },
      data: { status: "EXTRACTING" },
    });

    const pdfBuffer = await readFile(catalogue.pdfPath);

    const extraction = await extractPDFText(pdfBuffer);

    await prisma.cataloguePage.deleteMany({ where: { catalogueId: id } });

    await prisma.catalogue.update({
      where: { id },
      data: {
        pageCount: extraction.pageCount,
        status: "PROCESSING",
      },
    });

    for (const page of extraction.pages) {
      await prisma.cataloguePage.create({
        data: {
          catalogueId: id,
          pageNumber: page.pageNumber,
          extractedText: page.text,
          status: "PENDING",
        },
      });
    }

    try {
      const pageImages = await renderPDFPages(
        pdfBuffer,
        id,
        extraction.pageCount
      );

      for (const pageImage of pageImages) {
        await prisma.cataloguePage.updateMany({
          where: {
            catalogueId: id,
            pageNumber: pageImage.pageNumber,
          },
          data: { imagePath: pageImage.imagePath },
        });
      }
    } catch (renderError) {
      console.warn("Could not render page images:", renderError);
    }

    return NextResponse.json({
      success: true,
      pageCount: extraction.pageCount,
      message: `Extracted ${extraction.pageCount} pages`,
    });
  } catch (error) {
    console.error("Error processing catalogue:", error);
    await prisma.catalogue.update({
      where: { id: (await params).id },
      data: { status: "FAILED", errorMessage: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to process catalogue" },
      { status: 500 }
    );
  }
}
