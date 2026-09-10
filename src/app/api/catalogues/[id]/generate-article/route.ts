import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateArticleForCatalogue } from "@/services/articles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    generateArticleForCatalogue(id).catch((err) => {
      console.error("Article generation error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Article generation started",
    });
  } catch (error) {
    console.error("Error starting article generation:", error);
    return NextResponse.json(
      { error: "Failed to start article generation" },
      { status: 500 }
    );
  }
}
