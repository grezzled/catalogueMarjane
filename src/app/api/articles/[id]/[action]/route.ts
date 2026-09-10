import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidateSite } from "@/lib/revalidate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params;

    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "approve":
        await prisma.article.update({
          where: { id },
          data: { status: "APPROVED" },
        });
        return NextResponse.json({ success: true });

      case "reject":
        await prisma.article.update({
          where: { id },
          data: { status: "REJECTED" },
        });
        return NextResponse.json({ success: true });

      case "publish":
        await prisma.article.update({
          where: { id },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });
        revalidateSite();
        return NextResponse.json({ success: true });

      case "unpublish":
        await prisma.article.update({
          where: { id },
          data: {
            status: "APPROVED",
            publishedAt: null,
          },
        });
        revalidateSite();
        return NextResponse.json({ success: true });

      case "delete":
        await prisma.article.delete({ where: { id } });
        revalidateSite();
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}
