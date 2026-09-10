import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidateSite } from "@/lib/revalidate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        catalogue: {
          select: { id: true, title: true, slug: true },
        },
        articleCategories: {
          include: { category: { select: { name: true, slug: true } } },
        },
        seoAnalysis: {
          select: { analysis: true },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    // Fetch related articles (same categories, excluding current article)
    const categoryIds = article.articleCategories.map((ac) => ac.category.slug);
    const relatedArticles = await prisma.article.findMany({
      where: {
        id: { not: id },
        status: "PUBLISHED",
        articleCategories: {
          some: {
            category: { slug: { in: categoryIds } },
          },
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        excerpt: true,
      },
      take: 5,
    });

    return NextResponse.json({ ...article, relatedArticles });
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const article = await prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const {
      title,
      slug,
      excerpt,
      content,
      metaTitle,
      metaDescription,
      primaryKeyword,
      secondaryKeywords,
      searchIntent,
      category,
      status,
      faq,
      relatedCategories,
      articleCategories,
    } = body;

    // Check slug uniqueness if changed
    if (slug && slug !== article.slug) {
      const existing = await prisma.article.findUnique({ where: { slug } });
      if (existing) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (primaryKeyword !== undefined) updateData.primaryKeyword = primaryKeyword;
    if (secondaryKeywords !== undefined) updateData.secondaryKeywords = secondaryKeywords;
    if (searchIntent !== undefined) updateData.searchIntent = searchIntent;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) updateData.status = status;
    if (faq !== undefined) updateData.faq = faq;
    if (relatedCategories !== undefined) updateData.relatedCategories = relatedCategories;

    // Handle status transitions
    if (status && status !== article.status) {
      if (status === "PUBLISHED" && article.status !== "PUBLISHED") {
        updateData.publishedAt = new Date();
      } else if (article.status === "PUBLISHED" && status !== "PUBLISHED") {
        updateData.publishedAt = null;
      }
    }

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    // Handle article categories if provided
    if (articleCategories !== undefined) {
      await prisma.articleCategory.deleteMany({ where: { articleId: id } });
      if (articleCategories.length > 0) {
        await prisma.articleCategory.createMany({
          data: articleCategories.map((catId: string) => ({
            articleId: id,
            categoryId: catId,
          })),
        });
      }
    }

    // Revalidate if status changed to/from published
    if (status !== article.status) {
      revalidateSite();
    }

    return NextResponse.json({ success: true, article: updatedArticle });
  } catch (error) {
    console.error("Error updating article:", error);
    return NextResponse.json(
      { error: "Failed to update article" },
      { status: 500 }
    );
  }
}
