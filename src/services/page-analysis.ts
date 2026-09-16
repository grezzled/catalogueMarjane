import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { PAGE_ANALYSIS_PROMPT } from "@/ai/prompts";
import { imageToBase64 } from "@/services/pdf";
import { cropProductImage } from "@/services/cropping";
import { detectCategory, detectBrand } from "@/services/categories";
import { findMatchingProduct } from "@/services/product-match";
import { extractJsonFromAIResponse } from "@/lib/utils";
import type { PageAnalysis } from "@/types";
import { dirname } from "path";

export interface PageAnalysisLog {
  step: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message: string;
  timestamp: Date;
}

export interface FullAnalysisResult {
  products: number;
  confidence: number;
  cropped: number;
}

export interface CropsOnlyResult {
  cropped: number;
  total: number;
}

async function getPage(pageId: string) {
  const page = await prisma.cataloguePage.findUnique({
    where: { id: pageId },
    include: { catalogue: true },
  });
  if (!page) throw new Error(`Page not found: ${pageId}`);
  return page;
}

/** Shared AI call: analyze one page image/text, return parsed analysis. */
async function callPageAI(
  page: Awaited<ReturnType<typeof getPage>>,
  addLog: (step: string, status: PageAnalysisLog["status"], message: string) => void
): Promise<PageAnalysis> {
  const provider = await AIProviderFactory.create(
    process.env.AI_PROVIDER || "gemini",
    process.env as Record<string, string | undefined>
  );

  let aiResponse: string;
  try {
    if (page.imagePath) {
      const imageBase64 = await imageToBase64(page.imagePath, page.catalogueId);
      const textContext = page.extractedText
        ? `\n\nExtracted text from PDF:\n${page.extractedText}`
        : "";
      addLog("ai_request", "in_progress", `Analyzing page ${page.pageNumber}...`);
      aiResponse = await provider.analyzeImage(
        imageBase64,
        PAGE_ANALYSIS_PROMPT + textContext
      );
    } else if (page.extractedText) {
      addLog("ai_request", "in_progress", `Analyzing page ${page.pageNumber} text...`);
      aiResponse = await provider.generateText(
        PAGE_ANALYSIS_PROMPT + `\n\nText content of catalogue page:\n${page.extractedText}`
      );
    } else {
      throw new Error("No image or text to analyze");
    }
  } catch (aiError: unknown) {
    const msg = aiError instanceof Error ? aiError.message : String(aiError);
    throw new Error(`AI request failed: ${msg}`);
  }

  try {
    return extractJsonFromAIResponse(aiResponse) as PageAnalysis;
  } catch {
    throw new Error(`AI returned invalid JSON: ${aiResponse?.slice(0, 300) || "empty response"}`);
  }
}

/**
 * Crop product images for products that have a bounding box but no image yet.
 * Returns the number of images cropped.
 */
async function cropMissingImages(
  page: Awaited<ReturnType<typeof getPage>>,
  products: PageAnalysis["products"],
  addLog: (step: string, status: PageAnalysisLog["status"], message: string) => void
): Promise<number> {
  const withBox = (products || []).filter((p) => p.boundingBox);
  let cropped = 0;
  for (const product of withBox) {
    const { match } = await findMatchingProduct({
      name: product.name,
      brand: product.brand,
      modelNumber: product.modelNumber,
      specs: product.features,
    });
    const dbProduct = match
      ? await prisma.product.findUnique({
          where: { id: match.id },
          select: { id: true, imageUrl: true },
        })
      : null;
    if (!dbProduct || dbProduct.imageUrl || !page.imagePath) continue;
    const outputPath = `${dirname(page.imagePath)}/../products/${dbProduct.id}-page${page.pageNumber}.webp`;
    try {
      const result = await cropProductImage(page.imagePath, product.boundingBox, outputPath, page.catalogueId);
      if (result) {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { imageUrl: result },
        });
        cropped++;
        addLog("crop", "in_progress", `Cropped ${cropped}/${withBox.length}: ${product.name}`.slice(0, 160));
      }
    } catch (cropErr) {
      console.error(`Failed to crop product ${product.name}:`, cropErr);
    }
  }
  return cropped;
}

/**
 * Full single-page re-analysis (previous "Regenerate AI" behavior):
 * AI analysis → update page → upsert products + offers → crop missing images.
 */
export async function analyzePageFull(
  pageId: string,
  onLog?: (log: PageAnalysisLog) => unknown
): Promise<FullAnalysisResult> {
  const logs: PageAnalysisLog[] = [];
  const addLog = (step: string, status: PageAnalysisLog["status"], message: string) => {
    const log = { step, status, message, timestamp: new Date() };
    logs.push(log);
    if (status === "error") console.error(`[${status.toUpperCase()}] ${step}: ${message}`);
    else console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
    if (onLog) {
      try {
        const r = onLog(log);
        if (r instanceof Promise) r.catch((e) => console.error("onLog error:", e));
      } catch (e) {
        console.error("onLog error:", e);
      }
    }
  };

  const page = await getPage(pageId);
  const analysis = await callPageAI(page, addLog);
  const products = analysis.products || [];
  const category = detectCategory(analysis.category || analysis.title || "");
  addLog("ai_request", "completed", `Found ${products.length} products on page ${page.pageNumber}`);

  await prisma.cataloguePage.update({
    where: { id: pageId },
    data: {
      aiAnalysis: JSON.stringify(analysis),
      pageType: analysis.pageType,
      category,
      productCount: products.length,
      status: "COMPLETED",
      aiModel: process.env.AI_PROVIDER || "gemini",
      confidence: analysis.confidence || 0,
      processedAt: new Date(),
    },
  });

  for (const product of products) {
    const brand = product.brand || detectBrand(product.name);

    const { fields, match, enrich } = await findMatchingProduct({
      name: product.name,
      brand,
      modelNumber: product.modelNumber,
      specs: product.features,
    });

    let dbProduct = match
      ? await prisma.product.findUniqueOrThrow({ where: { id: match.id } })
      : await prisma.product.create({
          data: {
            name: product.name,
            normalizedName: fields.normalizedName,
            identityKey: fields.identityKey,
            modelNumber: fields.modelNumber,
            size: fields.size,
            sizeNum: fields.sizeNum,
            variant: fields.variant,
            coreName: fields.coreName,
            brand,
            category: product.category || category,
            subcategory: product.subcategory,
            specifications: JSON.stringify(product.features),
          },
        });

    if (match && enrich) {
      await prisma.product.update({ where: { id: dbProduct.id }, data: enrich });
    }

    if (product.salePrice || product.originalPrice) {
      // Re-runs must not duplicate offers: skip when the same product + page +
      // sale price already has an offer (re-analysis of the same page).
      const duplicate = await prisma.offer.findFirst({
        where: {
          productId: dbProduct.id,
          cataloguePageId: page.id,
          salePrice: product.salePrice,
        },
        select: { id: true },
      });
      if (duplicate) continue;

      const discountPercentage = product.discountPercentage ??
        (product.originalPrice && product.salePrice && product.originalPrice > product.salePrice
          ? Math.round(((product.originalPrice - product.salePrice) / product.originalPrice) * 100)
          : null);

      const discountAmount = product.discountAmount ??
        (product.originalPrice && product.salePrice
          ? product.originalPrice - product.salePrice
          : null);

      await prisma.offer.create({
        data: {
          productId: dbProduct.id,
          catalogueId: page.catalogueId,
          cataloguePageId: page.id,
          originalPrice: product.originalPrice,
          salePrice: product.salePrice,
          currency: product.currency || "MAD",
          discountAmount,
          discountPercentage,
          installmentAmount: product.installment?.amount,
          installmentMonths: product.installment?.months,
          availability: product.availabilityText,
          confidence: product.confidence,
          startDate: page.catalogue.startDate,
          endDate: page.catalogue.endDate,
        },
      });
    }
  }

  const cropped = await cropMissingImages(page, products, addLog);
  addLog(
    "complete",
    "completed",
    `Page ${page.pageNumber}: ${products.length} products, ${cropped} cropped`
  );
  return { products: products.length, confidence: analysis.confidence || 0, cropped };
}

/**
 * Crops-only re-run (previous "Crop Images" behavior):
 * AI analysis → crop images for products that lack one. No product/offer writes.
 */
export async function fillMissingPageCrops(
  pageId: string,
  onLog?: (log: PageAnalysisLog) => unknown
): Promise<CropsOnlyResult> {
  const addLog = (step: string, status: PageAnalysisLog["status"], message: string) => {
    const log = { step, status, message, timestamp: new Date() };
    if (status === "error") console.error(`[${status.toUpperCase()}] ${step}: ${message}`);
    else console.log(`[${status.toUpperCase()}] ${step}: ${message}`);
    if (onLog) {
      try {
        const r = onLog(log);
        if (r instanceof Promise) r.catch((e) => console.error("onLog error:", e));
      } catch (e) {
        console.error("onLog error:", e);
      }
    }
  };

  const page = await getPage(pageId);
  if (!page.imagePath) throw new Error("Page has no image");
  const analysis = await callPageAI(page, addLog);
  const products = analysis.products || [];
  addLog("ai_request", "completed", `Found ${products.length} products on page ${page.pageNumber}`);
  const cropped = await cropMissingImages(page, products, addLog);
  addLog("complete", "completed", `Cropped ${cropped}/${products.length} product images`);
  return { cropped, total: products.length };
}
