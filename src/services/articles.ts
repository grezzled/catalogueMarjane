import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { ARTICLE_GENERATION_PROMPT, SEO_QUALITY_PROMPT, articleTypeInstruction, pickStructureVariant } from "@/ai/prompts";
import { extractJsonFromAIResponse, slugify, truncateText } from "@/lib/utils";
import { scoreArticle } from "@/services/seo-score";
import { getArticleType, selectOffersForType } from "@/lib/article-types";
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
  articleSlug?: string;
  logs: GenerationLog[];
  error?: string;
}

export interface PriceCheck {
  product: string;
  salePrice: number | null;
  nameFound: boolean;
  priceFound: boolean;
}

export interface PriceVerification {
  checked: number;
  matched: number;
  /** 0-100, or -1 when nothing was verifiable (falls back to AI score). */
  score: number;
  mismatched: PriceCheck[];
}

const NAME_STOPWORDS = new Set([
  "avec", "pour", "dans", "sans", "plus", "moins", "tout", "tous", "toutes",
  "entre", "comme", "dont", "chez", "sous", "vers", "pack", "lot",
]);

export function priceVariants(p: number): string[] {
  const raw = String(p);
  const grouped = p.toLocaleString("en-US").replace(/,/g, " ");
  const groupedNnbsp = p.toLocaleString("fr-FR");
  // AI prose uses regular spaces ("1 490 DH"), not narrow no-break spaces.
  const groupedSpace = groupedNnbsp.replace(/[\u202f\u00a0]/g, " ");
  return [...new Set([raw, grouped, groupedNnbsp, groupedSpace])];
}

/**
 * Real factual check: every offer whose product is mentioned in the article
 * must also show its sale price. Returns -1 when no product name from the
 * catalogue appears in the text (nothing verifiable).
 */
export function verifyPricesAgainstOffers(
  content: string,
  offers: Array<{ salePrice: number | null; product: { name: string } }>
): PriceVerification {
  const text = content.toLowerCase();
  const mismatched: PriceCheck[] = [];
  let checked = 0;
  let matched = 0;

  for (const offer of offers) {
    const tokens = offer.product.name
      .toLowerCase()
      .split(/[^a-zàâäéèêëîïôöùûüç0-9]+/i)
      .filter((t) => t.length >= 4 && !NAME_STOPWORDS.has(t));
    const significant = tokens.length > 0
      ? tokens
      : offer.product.name.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüç0-9]+/i).filter(Boolean);
    if (significant.length === 0) continue;
    const nameFound = significant.every((t) => text.includes(t));
    if (!nameFound) continue;
    checked++;
    const priceFound =
      offer.salePrice == null
        ? true
        : priceVariants(offer.salePrice).some((v) => text.includes(v.toLowerCase()));
    if (priceFound) {
      matched++;
    } else {
      mismatched.push({
        product: offer.product.name,
        salePrice: offer.salePrice,
        nameFound,
        priceFound,
      });
    }
  }

  return {
    checked,
    matched,
    score: checked === 0 ? -1 : Math.round((matched / checked) * 100),
    mismatched,
  };
}

export interface VerifiedOfferRow {
  productName: string;
  imageUrl: string | null;
  originalPrice: number | null;
  salePrice: number;
  currency: string;
  discountPercentage: number | null;
  category: string;
  pageNumber: number | null;
  endDate: Date;
}

function formatPrice(p: number, currency: string): string {
  return `${p.toLocaleString("fr-FR")} ${currency || "MAD"}`;
}

function effectiveDiscount(row: VerifiedOfferRow): number | null {
  if (row.discountPercentage != null) return Math.round(row.discountPercentage);
  if (row.originalPrice != null && row.originalPrice > row.salePrice) {
    return Math.round(((row.originalPrice - row.salePrice) / row.originalPrice) * 100);
  }
  return null;
}

function economyLabel(row: VerifiedOfferRow): string {
  const d = effectiveDiscount(row);
  return d != null ? `-${d}%` : "—";
}

function cellText(value: string): string {
  return value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

/**
 * Deterministic data block: the database is the source of truth for prices.
 * Built from Offer rows (never from AI text) and appended to every generated
 * article, so readers always get exact prices, discounts, pages and expiry.
 */
export function buildVerifiedOffersTable(opts: {
  catalogueSlug: string;
  rows: VerifiedOfferRow[];
  categorySlugs: Record<string, string>;
  validUntil: Date;
  maxRows?: number;
}): string {
  const ranked = [...opts.rows]
    .filter((r) => r.salePrice != null)
    .sort((a, b) => (effectiveDiscount(b) ?? 0) - (effectiveDiscount(a) ?? 0))
    .slice(0, opts.maxRows ?? 15);

  if (ranked.length === 0) return "";

  const validUntil = validUntilFr(opts.validUntil);
  const lines = [
    `## Offres vérifiées`,
    ``,
    `_Prix relevés du catalogue, valables jusqu'au ${validUntil}._`,
    ``,
    `| Produit | Prix normal | Prix promo | Économie | Catégorie | Page | Valable jusqu'au |`,
    `|---------|-------------|------------|----------|-----------|------|------------------|`,
  ];

  for (const row of ranked) {
    const name = cellText(row.productName);
    const productCell = row.imageUrl
      ? `![${name}](${row.imageUrl}) ${name}`
      : name;
    const normalCell = row.originalPrice != null ? formatPrice(row.originalPrice, row.currency) : "—";
    const categoryCell = opts.categorySlugs[row.category]
      ? `[${cellText(row.category)}](/category/${opts.categorySlugs[row.category]})`
      : cellText(row.category) || "—";
    const pageCell =
      row.pageNumber != null
        ? `[Page ${row.pageNumber}](/catalogue-marjane/${opts.catalogueSlug}#page-${row.pageNumber})`
        : "—";
    lines.push(
      `| ${productCell} | ${normalCell} | ${formatPrice(row.salePrice, row.currency)} | ${economyLabel(row)} | ${categoryCell} | ${pageCell} | ${validUntil} |`
    );
  }

  return lines.join("\n");
}

function validUntilFr(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR");
}

function fixArticleLinks(content: string): string {  // Fix /catalogue-marjane/{slug}/CategoryName → /category/{category-slug}
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

  // Legacy standalone page URLs are gone (301 → catalogue anchor): convert
  // /catalogue-marjane/{slug}/page/8 → /catalogue-marjane/{slug}#page-8
  content = content.replace(
    /\(\/catalogue-marjane\/([^)]+?)\/page\/(\d+)\)/g,
    (match, slug, pageNum) => `(/catalogue-marjane/${slug}#page-${pageNum})`
  );

  // Same for bare /catalogue-marjane/{slug}/8 links (missing prefix form)
  content = content.replace(
    /\(\/catalogue-marjane\/([^)]+?)\/(\d+)\)/g,
    (match, slug, pageNum) => `(/catalogue-marjane/${slug}#page-${pageNum})`
  );

  // Fix absolute image paths to relative paths
  content = content.replace(
    /\/Users\/[^)]+?\/public\/uploads\//g,
    '/uploads/'
  );

  return content;
}

export interface GenerateArticleOptions {
  onLog?: (log: GenerationLog) => unknown;
  /** Intent id from the article-type registry (default: "overview"). */
  articleType?: string;
  /** Focus category for category-scoped types. */
  category?: string;
}

export async function generateArticleForCatalogue(
  catalogueId: string,
  opts?: GenerateArticleOptions | ((log: GenerationLog) => unknown)
): Promise<GenerationResult> {
  const { onLog, articleType: rawType, category: rawCategory } =
    typeof opts === "function" ? { onLog: opts, articleType: undefined, category: undefined } : (opts ?? {});
  const def = getArticleType(rawType);
  const focus = rawCategory?.trim() || null;
  const logs: GenerationLog[] = [];

  const addLog = (step: string, status: GenerationLog["status"], message: string) => {
    const log = { step, status, message, timestamp: new Date() };
    logs.push(log);
    console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
    if (onLog) {
      try {
        const r = onLog(log);
        if (r instanceof Promise) r.catch((e) => console.error("onLog error:", e));
      } catch (e) {
        console.error("onLog error:", e);
      }
    }
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

    // Intent data slice: focused types only see their own offers, so the
    // prose, the verified table and the price check stay on-angle.
    if (def.needsCategory && !focus) {
      const error = `Article type "${def.label}" requires a focus category`;
      addLog("slice", "error", error);
      return { success: false, logs, error };
    }
    const sliceOffers = selectOffersForType(catalogue.offers, def.id, focus ?? undefined);
    if (sliceOffers.length < def.minOffers) {
      const error = `Not enough data for "${def.label}" (${sliceOffers.length} offer(s), minimum ${def.minOffers}) — article refused`;
      addLog("slice", "error", error);
      return { success: false, logs, error };
    }
    addLog("slice", "completed", `Type "${def.label}"${focus ? ` (${focus})` : ""}: ${sliceOffers.length} offers in scope`);

    const topOffers = sliceOffers;

    const scopedPages = focus
      ? catalogue.pages.filter((p) => p.category === focus)
      : catalogue.pages;
    const categories = focus
      ? [focus]
      : [...new Set(catalogue.pages.map((p) => p.category).filter(Boolean))];
    const categorySlugMap = categories.filter(Boolean).map(c => `${c} → ${c!.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`);

    addLog("prepare_context", "in_progress", "Preparing AI context...");

    const context = `
CATALOGUE: ${catalogue.title}
CATALOGUE SLUG: ${catalogue.slug}
ARTICLE TYPE: ${def.label}${focus ? ` — FOCUS CATEGORY: ${focus}` : ""}
STORE: ${catalogue.store === "marjane" ? "Marjane" : catalogue.store === "marjane_hyper" ? "Marjane Hyper" : catalogue.store === "marjane_market" ? "Marjane Market" : catalogue.store}
DATES: Du ${catalogue.startDate.toISOString().split("T")[0]} au ${catalogue.endDate.toISOString().split("T")[0]}
TYPE: ${catalogue.type}
TOTAL PRODUCTS: ${catalogue.productCount}
TOTAL OFFERS: ${catalogue.offerCount}
CATEGORIES: ${categories.join(", ")}

VALID LINK FORMATS (use ONLY these, no other patterns):
- [Voir page X](/catalogue-marjane/${catalogue.slug}#page-{pageNumber})
- [Voir le catalogue complet](/catalogue-marjane/${catalogue.slug})
- [promotions {Category}](/promotions-marjane/{category-slug})

CATEGORY SLUGS:
${categorySlugMap.map(s => `- ${s}`).join("\n")}

NEVER create links like /catalogue-marjane/{slug}/CategoryName — this route does not exist.

PAGES WITH CATEGORIES (use these for internal links and include page images):
${scopedPages
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
${scopedPages
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

    // Rotate the article skeleton per catalogue AND intent so successive
    // articles (even for one catalogue) don't share one identical template.
    const variant = pickStructureVariant(`${catalogueId}:${def.id}:${focus ?? ""}`);
    addLog("generate_article", "in_progress", `Using structure variant "${variant.id}"...`);

    const response = await provider.generateText(
      ARTICLE_GENERATION_PROMPT + "\n\n" + articleTypeInstruction(def.id) + "\n\n" + variant.instruction + "\n\nDATA:\n" + context
    );

    addLog("generate_article", "completed", "Article generated successfully");

    const articleData = extractJsonFromAIResponse(response) as ArticleGeneration;

    // Fix broken internal links in generated content
    if (articleData.content) {
      articleData.content = fixArticleLinks(articleData.content);
    }

    // Deterministic data block: exact prices straight from the Offer rows.
    // The AI writes prose only — this table is the price source of truth.
    addLog("verified_table", "in_progress", "Building verified offers table...");
    const pageNumbers = new Map(
      catalogue.pages.map((p) => [p.id, p.pageNumber] as const)
    );
    const offerCategories = [
      ...new Set(
        sliceOffers
          .map((o) => o.product.category)
          .filter((c): c is string => !!c)
      ),
    ];
    const categoryRows = await prisma.category.findMany({
      where: { name: { in: offerCategories } },
      select: { name: true, slug: true },
    });
    const categorySlugs: Record<string, string> = {};
    for (const c of categoryRows) categorySlugs[c.name] = c.slug;
    const verifiedTable = buildVerifiedOffersTable({
      catalogueSlug: catalogue.slug,
      rows: sliceOffers.map((o) => ({
        productName: o.product.name,
        imageUrl: o.product.imageUrl,
        originalPrice: o.originalPrice,
        salePrice: o.salePrice ?? 0,
        currency: o.currency || "MAD",
        discountPercentage: o.discountPercentage,
        category: o.product.category,
        pageNumber: o.cataloguePageId ? pageNumbers.get(o.cataloguePageId) ?? null : null,
        endDate: o.endDate,
      })),
      categorySlugs,
      validUntil: catalogue.endDate,
    });
    if (verifiedTable) {
      articleData.content = `${articleData.content.trimEnd()}\n\n${verifiedTable}\n`;
      addLog("verified_table", "completed", "Appended verified offers table");
    } else {
      addLog("verified_table", "pending", "No priced offers — table skipped");
    }

    addLog("seo_analysis", "in_progress", "Running SEO quality analysis...");

    const qualityResponse = await provider.generateText(
      SEO_QUALITY_PROMPT + "\n\nARTICLE:\n" + articleData.content
    );

    const quality = extractJsonFromAIResponse(qualityResponse) as SEOQuality;

    addLog("seo_analysis", "completed", `SEO Score: ${quality.seoScore}, Recommendation: ${quality.recommendation}`);

    // Real factual check against the slice's offers — overrides the
    // self-graded score, and forces human review on price mismatches.
    const priceVerification = verifyPricesAgainstOffers(articleData.content, sliceOffers);
    if (priceVerification.score >= 0) {
      quality.factualAccuracyScore = priceVerification.score;
      addLog(
        "price_check",
        priceVerification.score >= 80 ? "completed" : "error",
        `Verified ${priceVerification.matched}/${priceVerification.checked} mentioned prices`
      );
      if (priceVerification.score < 80 && quality.recommendation === "publish") {
        quality.recommendation = "review";
        addLog(
          "price_check",
          "error",
          `Downgraded to review: ${priceVerification.mismatched.length} price mismatch(es)`
        );
      }
    } else {
      addLog("price_check", "pending", "No catalogue products mentioned — keeping AI score");
    }

    let slug = slugify(articleData.slug || articleData.title);
    const existingArticle = await prisma.article.findUnique({
      where: { slug },
    });
    if (existingArticle) {
      slug = `${slug}-${Date.now()}`;
    }

    addLog("save_article", "in_progress", "Saving article to database...");

    const faqItems = Array.isArray(articleData.faq)
      ? articleData.faq.filter(
          (f): f is { question: string; answer: string } =>
            !!f && typeof f.question === "string" && typeof f.answer === "string"
        )
      : [];

    // Deterministic SEO scorecard — replaces the AI self-grade as the
    // authoritative seoScore. Computed from stored fields + content.
    addLog("seo_checklist", "in_progress", "Computing deterministic SEO score...");
    const metaTitle = articleData.metaTitle || truncateText(articleData.title, 60);
    const metaDescription =
      articleData.metaDescription ||
      truncateText(articleData.excerpt || articleData.content, 160);
    const titleClash = await prisma.article.count({
      where: { title: articleData.title },
    });
    const scorecard = scoreArticle({
      title: articleData.title,
      metaTitle,
      metaDescription,
      content: articleData.content,
      faq: faqItems,
      publishedAt: null,
      updatedAt: new Date(),
      offerCount: sliceOffers.length,
      titleUnique: titleClash === 0,
    });
    addLog("seo_checklist", "completed", `Deterministic SEO score: ${scorecard.score}/100`);

    const article = await prisma.article.create({
      data: {
        title: articleData.title,
        slug,
        metaTitle,
        metaDescription,
        excerpt: articleData.excerpt,
        content: articleData.content,
        faq: faqItems.length > 0 ? JSON.stringify(faqItems) : null,
        primaryKeyword: articleData.primaryKeyword,
        secondaryKeywords: JSON.stringify(articleData.secondaryKeywords || []),
        searchIntent: articleData.searchIntent,
        catalogueId,
        articleType: def.id,
        articleFocus: focus,
        status: quality.recommendation === "publish" ? "APPROVED" : "REVIEW",
        seoScore: scorecard.score,
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
        analysis: JSON.stringify({ ...quality, priceVerification, deterministic: scorecard }),
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

    return { success: true, articleId: article.id, articleSlug: slug, logs };
  } catch (error) {
    addLog("error", "error", `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { success: false, logs, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
