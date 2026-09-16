import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getArticleTypeOptions } from "@/lib/article-types";

// Covered by the middleware matcher (/api/catalogues/:path*) — admin only.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!catalogue) {
      return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
    }

    const options = await getArticleTypeOptions(id, prisma);
    return NextResponse.json({ catalogue, options });
  } catch (error) {
    console.error("Error fetching article type options:", error);
    return NextResponse.json(
      { error: "Failed to fetch article type options" },
      { status: 500 }
    );
  }
}
