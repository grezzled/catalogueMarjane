import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { ARTICLE_GENERATION_PROMPT, SEO_QUALITY_PROMPT } from "@/ai/prompts";
import { extractJsonFromAIResponse, slugify, truncateText } from "@/lib/utils";
import type { ArticleGeneration, SEOQuality } from "@/types";

export interface GenerationLog {
  step: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message: string;
  timestamp: Date;
}

export interface GenerationResult {
  success: boolean;
  articleId?: string;
  logs: GenerationLog[];
  error?: string;
}

function fixArticleLinks(content: string, catalogueSlug: string): string {
  // Fix /catalogue-marjane/{slug}/CategoryName → /category/{category-slug}
  content = content.replace(
    /\[([^\]]+)\]\(\/catalogue-marjane\/[^)]+?\/([A-ZÉÈÊËÀÂÎÔÛÇ][a-zéèêëàâîôûç]+)\)/g,
    (match, text, category) => {
      const categorySlug = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
      return `[${text}](/category/${categorySlug})`;
    }
  );

  // Fix /catalogue-marjane/{slug}/CategoryName without link syntax (bare URL in text)
  content = content.replace(
    /(\/catalogue-marjane\/[^)\s]+?)\/([A-ZÉÈÊËÀÂÎÔÛÇ][a-zéèêëàâîôûç]+)(?=\s|[.,)!]|$)/g,
    (match, basePath, category) => {
      const categorySlug = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
      return `/category/${categorySlug}`;
    }
  );

  // Fix catalogue links missing /page/ prefix: /catalogue-marjane/{slug}/8 → /catalogue-marjane/{slug}/page/8
  content = content.replace(
    /\(\/catalogue-marjane\/([^)]+?)\/(\d+)\)/g,
    (match, slug, pageNum) => `(/catalogue-marjane/${slug}/page/${pageNum})`
  );

  // Fix absolute image paths to relative paths
  content = content.replace(
    /\/Users\/[^)]+?\/public\/uploads\//g,
    '/uploads/'
  );

  return content;
}

export async function generateArticleForCatalogue(
  catalogueId: string
): Promise<GenerationResult> {
  const logs: GenerationLog[] = [];

  const addLog = (step: string, status: GenerationLog["status"], message: string) => {
    logs.push({ step, status, message, timestamp: new Date() });
    console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
  };

  try {
    addLog("init", "in_progress", "Starting article generation...");

    const catalogue = await prisma.catalogue.findUnique({
      where: { id: catalogueId },
      include: {
        pages: {
          where: { status: "COMPLETED" },
          orderBy: { pageNumber: "asc" },
        },
        offers: {
          include: { product: true },
          orderBy: { discountPercentage: "desc" },
        },
      },
    });

    if (!catalogue) {
      addLog("init", "error", `Catalogue not found: ${catalogueId}`);
      return { success: false, logs, error: `Catalogue not found: ${catalogueId}` };
    }

    addLog("fetch_data", "completed", `Found ${catalogue.offers.length} offers, ${catalogue.pages.length} pages`);

    const topOffers = catalogue.offers
      .filter((o) => o.discountPercentage && o.discountPercentage > 10)
      .slice(0, 20);

    const categories = [...new Set(catalogue.pages.map((p) => p.category).filter(Boolean))];
    const categorySlugMap = categories.filter(Boolean).map(c => `${c} → ${c!.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`);

    const pagesWithCategories = catalogue.pages
      .filter(p => p.category)
      .map(p => ({ pageNumber: p.pageNumber, category: p.category }));

    addLog("prepare_context", "in_progress", "Preparing AI context...");

    const context = `
CATALOGUE: ${catalogue.title}
CATALOGUE SLUG: ${catalogue.slug}
STORE: ${catalogue.store === "marjane" ? "Marjane" : catalogue.store === "marjane_hyper" ? "Marjane Hyper" : catalogue.store === "marjane_market" ? "Marjane Market" : catalogue.store}
DATES: Du ${catalogue.startDate.toISOString().split("T")[0]} au ${catalogue.endDate.toISOString().split("T")[0]}
TYPE: ${catalogue.type}
TOTAL PRODUCTS: ${catalogue.productCount}
TOTAL OFFERS: ${catalogue.offerCount}
CATEGORIES: ${categories.join(", ")}

VALID LINK FORMATS (use ONLY these, no other patterns):
- [Voir page X](/catalogue-marjane/${catalogue.slug}/page/{pageNumber})
- [Voir le catalogue complet](/catalogue-marjane/${catalogue.slug})
- [promotions {Category}](/promotions-marjane/{category-slug})

CATEGORY SLUGS:
${categorySlugMap.map(s => `- ${s}`).join("\n")}

NEVER create links like /catalogue-marjane/{slug}/CategoryName — this route does not exist.

PAGES WITH CATEGORIES (use these for internal links and include page images):
${catalogue.pages
  .filter(p => p.category)
  .map(p => `- Page ${p.pageNumber}: ${p.category} ${p.imagePath ? `[Page Image: ${p.imagePath}]` : ""}`)
  .join("\n")}

TOP OFFERS:
${topOffers
  .map(
    (o) =>
      `- ${o.product.name}: ${o.originalPrice} DH → ${o.salePrice} DH (-${o.discountPercentage}%) [Page ${o.cataloguePageId ? catalogue.pages.find(p => p.id === o.cataloguePageId)?.pageNumber || "?" : "?"}] [Image: ${o.product.imageUrl || "/placeholder-product.svg"}]`
  )
  .join("\n")}

PAGE SUMMARIES:
${catalogue.pages
  .map((p) => {
    const analysis = p.aiAnalysis as Record<string, unknown> | null;
    return `Page ${p.pageNumber} (${p.category || "unknown"}): ${analysis?.summary || "N/A"}`;
  })
  .join("\n")}
`;

    addLog("prepare_context", "completed", "Context prepared successfully");

    addLog("generate_article", "in_progress", "Generating article with AI...");

    const provider = await AIProviderFactory.create(
      process.env.AI_PROVIDER || "gemini",
      process.env as Record<string, string | undefined>
    );

    const response = await provider.generateText(
      ARTICLE_GENERATION_PROMPT + "\n\nDATA:\n" + context
    );

    addLog("generate_article", "completed", "Article generated successfully");

    const articleData = extractJsonFromAIResponse(response) as ArticleGeneration;

    // Fix broken internal links in generated content
    if (articleData.content) {
      articleData.content = fixArticleLinks(articleData.content, catalogue.slug);
    }

    addLog("seo_analysis", "in_progress", "Running SEO quality analysis...");

    const qualityResponse = await provider.generateText(
      SEO_QUALITY_PROMPT + "\n\nARTICLE:\n" + articleData.content
    );

    const quality = extractJsonFromAIResponse(qualityResponse) as SEOQuality;

    addLog("seo_analysis", "completed", `SEO Score: ${quality.seoScore}, Recommendation: ${quality.recommendation}`);

    let slug = slugify(articleData.slug || articleData.title);
    const existingArticle = await prisma.article.findUnique({
      where: { slug },
    });
    if (existingArticle) {
      slug = `${slug}-${Date.now()}`;
    }

    addLog("save_article", "in_progress", "Saving article to database...");

    const article = await prisma.article.create({
      data: {
        title: articleData.title,
        slug,
        metaTitle: articleData.metaTitle || truncateText(articleData.title, 60),
        metaDescription:
          articleData.metaDescription ||
          truncateText(articleData.excerpt || articleData.content, 160),
        excerpt: articleData.excerpt,
        content: articleData.content,
        primaryKeyword: articleData.primaryKeyword,
        secondaryKeywords: JSON.stringify(articleData.secondaryKeywords || []),
        searchIntent: articleData.searchIntent,
        catalogueId,
        status: quality.recommendation === "publish" ? "APPROVED" : "REVIEW",
        seoScore: quality.seoScore,
        contentQualityScore: quality.contentQualityScore,
        originalityScore: quality.originalityScore,
        factualAccuracyScore: quality.factualAccuracyScore,
        searchIntentScore: quality.searchIntentScore,
        thinContentRisk: quality.thinContentRisk,
        keywordStuffingRisk: quality.keywordStuffingRisk,
        recommendation: quality.recommendation,
      },
    });

    addLog("save_article", "completed", `Article saved with ID: ${article.id}`);

    addLog("seo_analysis", "in_progress", "Saving SEO analysis...");

    await prisma.sEOAnalysis.create({
      data: {
        articleId: article.id,
        analysis: JSON.stringify(quality),
        score:
          (quality.seoScore +
            quality.contentQualityScore +
            quality.factualAccuracyScore) /
          3,
      },
    });

    addLog("seo_analysis", "completed", "SEO analysis saved");

    addLog("categories", "in_progress", "Linking categories...");

    const categoryNames = articleData.relatedCategories || [];
    for (const catName of categoryNames) {
      const catSlug = slugify(catName);
      let category = await prisma.category.findUnique({
        where: { slug: catSlug },
      });
      if (!category) {
        category = await prisma.category.create({
          data: { name: catName, slug: catSlug },
        });
      }
      await prisma.articleCategory.create({
        data: { articleId: article.id, categoryId: category.id },
      });
    }

    addLog("categories", "completed", `Linked ${categoryNames.length} categories`);

    addLog("update_catalogue", "in_progress", "Updating catalogue article count...");

    await prisma.catalogue.update({
      where: { id: catalogueId },
      data: {
        articleCount: { increment: 1 },
      },
    });

    addLog("update_catalogue", "completed", "Catalogue updated");
    addLog("complete", "completed", "Article generation completed successfully!");

    return { success: true, articleId: article.id, logs };
  } catch (error) {
    addLog("error", "error", `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { success: false, logs, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
