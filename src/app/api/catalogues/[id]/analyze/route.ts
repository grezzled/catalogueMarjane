import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processCatalogue } from "@/services/processing";

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

    processCatalogue(id).catch((err) => {
      console.error("Background processing error:", err);
      prisma.catalogue.update({
        where: { id },
        data: { status: "FAILED", errorMessage: String(err) },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Processing started in background",
    });
  } catch (error) {
    console.error("Error starting analysis:", error);
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 }
    );
  }
}
