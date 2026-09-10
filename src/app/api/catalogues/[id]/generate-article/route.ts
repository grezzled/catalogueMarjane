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

    const result = await generateArticleForCatalogue(id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        articleId: result.articleId,
        logs: result.logs,
        message: "Article generated successfully",
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        logs: result.logs,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error generating article:", error);
    return NextResponse.json(
      { error: "Failed to generate article" },
      { status: 500 }
    );
  }
}
