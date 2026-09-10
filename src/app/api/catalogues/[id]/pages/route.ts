import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pages = await prisma.cataloguePage.findMany({
      where: { catalogueId: id },
      orderBy: { pageNumber: "asc" },
      select: {
        id: true,
        pageNumber: true,
        status: true,
        pageType: true,
        category: true,
        productCount: true,
        confidence: true,
        aiModel: true,
        extractedText: true,
        imagePath: true,
        aiAnalysis: true,
      },
    });

    return NextResponse.json(pages);
  } catch (error) {
    console.error("Error fetching page progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch page progress" },
      { status: 500 }
    );
  }
}