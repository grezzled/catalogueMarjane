import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { scoreArticle } from "@/services/seo-score";

function parseFaq(raw: unknown): Array<{ question: string; answer: string }> {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is { question: string; answer: string } =>
        !!f && typeof f.question === "string" && typeof f.answer === "string"
    );
  } catch {
    return [];
  }
}

/**
 * Recompute the deterministic SEO scorecard for an article (e.g. after a
 * manual content edit). Updates the stored score + analysis breakdown.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        catalogue: {
          select: { _count: { select: { offers: true } } },
        },
      },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const titleClash = await prisma.article.count({
      where: { title: article.title, id: { not: id } },
    });

    const scorecard = scoreArticle({
      title: article.title,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      content: article.content,
      faq: parseFaq(article.faq),
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      offerCount: article.catalogue?._count.offers ?? 0,
      titleUnique: titleClash === 0,
    });

    await prisma.article.update({
      where: { id },
      data: { seoScore: scorecard.score },
    });

    const existing = await prisma.sEOAnalysis.findUnique({
      where: { articleId: id },
    });
    if (existing) {
      let prev: Record<string, unknown> = {};
      try {
        prev = JSON.parse(existing.analysis) as Record<string, unknown>;
      } catch {
        prev = {};
      }
      await prisma.sEOAnalysis.update({
        where: { articleId: id },
        data: { analysis: JSON.stringify({ ...prev, deterministic: scorecard }) },
      });
    } else {
      await prisma.sEOAnalysis.create({
        data: {
          articleId: id,
          analysis: JSON.stringify({ deterministic: scorecard }),
          score: scorecard.score,
        },
      });
    }

    return NextResponse.json({ success: true, ...scorecard });
  } catch (error) {
    console.error("Error scoring article:", error);
    return NextResponse.json({ error: "Failed to score article" }, { status: 500 });
  }
}
