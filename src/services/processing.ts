import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { PAGE_ANALYSIS_PROMPT } from "@/ai/prompts";
import { imageToBase64 } from "@/services/pdf";
import { cropProductImage } from "@/services/cropping";
import {
  detectCategory,
  detectBrand,
} from "@/services/categories";
import { findMatchingProduct } from "@/services/product-match";
import { assignProductSlug } from "@/services/products";
import { extractJsonFromAIResponse } from "@/lib/utils";
import type { PageAnalysis } from "@/types";

export interface ProcessingLog {
  step: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message: string;
  timestamp: Date;
}

export async function processCatalogue(
  catalogueId: string,
  onLog?: (log: ProcessingLog) => unknown
): Promise<void> {
  const logs: ProcessingLog[] = [];
  const addLog = (step: string, status: ProcessingLog["status"], message: string) => {
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

  const catalogue = await prisma.catalogue.findUnique({
    where: { id: catalogueId },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });

  if (!catalogue) throw new Error(`Catalogue not found: ${catalogueId}`);

  await prisma.catalogue.update({
    where: { id: catalogueId },
    data: { status: "ANALYZING" },
  });

  const provider = await AIProviderFactory.create(
    process.env.AI_PROVIDER || "gemini",
    process.env as Record<string, string | undefined>
  );

  const totalPages = catalogue.pages.length;
  let processedPages = 0;
  let totalProducts = 0;
  let totalOffers = 0;

  addLog("start", "in_progress", `Analyzing ${totalPages} pages...`);

  for (const page of catalogue.pages) {
    const current = await prisma.catalogue.findUnique({ where: { id: catalogueId }, select: { paused: true } });
    if (current?.paused) {
      addLog("paused", "pending", `Catalogue paused at page ${page.pageNumber}, stopping`);
      return;
    }

    if (page.status === "COMPLETED" && page.aiAnalysis) {
      processedPages++;
      continue;
    }

    addLog("analyze_page", "in_progress", `Page ${page.pageNumber}/${totalPages}...`);

    try {
      await prisma.cataloguePage.update({
        where: { id: page.id },
        data: { status: "PROCESSING" },
      });

      let analysis: PageAnalysis;

      if (page.imagePath) {
        const imageBase64 = await imageToBase64(page.imagePath, catalogueId);
        const textContext = page.extractedText
          ? `\n\nExtracted text from PDF:\n${page.extractedText}`
          : "";

        const response = await provider.analyzeImage(
          imageBase64,
          PAGE_ANALYSIS_PROMPT + textContext
        );

        analysis = extractJsonFromAIResponse(response) as PageAnalysis;
      } else if (page.extractedText) {
        const response = await provider.generateText(
          PAGE_ANALYSIS_PROMPT +
            `\n\nText content of catalogue page:\n${page.extractedText}`
        );
        analysis = extractJsonFromAIResponse(response) as PageAnalysis;
      } else {
        analysis = {
          pageNumber: page.pageNumber,
          pageType: "unknown",
          products: [],
          confidence: 0,
        };
      }

      const products = analysis.products || [];
      const pageProductCount = products.length;
      const pageOfferCount = products.filter(
        (p) => p.salePrice !== null && p.salePrice !== undefined
      ).length;

      const category = detectCategory(
        analysis.category || analysis.title || ""
      );

      await prisma.cataloguePage.update({
        where: { id: page.id },
        data: {
          aiAnalysis: JSON.stringify(analysis),
          pageType: analysis.pageType,
          category,
          productCount: pageProductCount,
          status: "COMPLETED",
          aiModel: process.env.AI_PROVIDER || "gemini",
          confidence: analysis.confidence || 0,
          processedAt: new Date(),
        },
      });

      for (const product of products) {
        const brand =
          product.brand || detectBrand(product.name);

        // Smart cross-catalogue matching: brand + model ref → identity key → legacy name.
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

    // Stable public URL: slug set once at creation (never renamed on enrich).
    if (!match && !dbProduct.slug) {
      const slug = await assignProductSlug(dbProduct.id, dbProduct.name);
      dbProduct = { ...dbProduct, slug };
    }

        // Converge stored rows toward complete identities.
        if (match && enrich) {
          dbProduct = await prisma.product.update({
            where: { id: dbProduct.id },
            data: enrich,
          });
        }

        if (product.boundingBox && page.imagePath && !dbProduct.imageUrl) {
          const outputPath = `${require("path").dirname(page.imagePath)}/../products/${dbProduct.id}-page${page.pageNumber}.webp`;
          try {
            const cropped = await cropProductImage(page.imagePath, product.boundingBox, outputPath, catalogueId);
            if (cropped) {
              await prisma.product.update({
                where: { id: dbProduct.id },
                data: { imageUrl: cropped },
              });
              dbProduct = { ...dbProduct, imageUrl: cropped };
              console.log(`Cropped product image: ${product.name} -> ${cropped}`);
            } else {
              console.warn(`Crop returned null for: ${product.name} (boundingBox: ${JSON.stringify(product.boundingBox)})`);
            }
          } catch (cropErr) {
            console.error(`Failed to crop product ${product.name}:`, cropErr);
          }
        }

        if (product.salePrice || product.originalPrice) {
          const startDate = catalogue.startDate;
          const endDate = catalogue.endDate;

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
              catalogueId,
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
              startDate,
              endDate,
            },
          });
          totalOffers++;
        }

        totalProducts++;
      }

      processedPages++;

      const progress = processedPages / totalPages;
      await prisma.catalogue.update({
        where: { id: catalogueId },
        data: {
          processedPages,
          productCount: totalProducts,
          offerCount: totalOffers,
          aiProcessingProgress: progress,
        },
      });
      addLog(
        "analyze_page",
        "completed",
        `Page ${page.pageNumber}/${totalPages}: ${pageProductCount} products, ${pageOfferCount} offers`
      );
    } catch (error: any) {
      console.error(`Error processing page ${page.pageNumber}:`, error);
      addLog("analyze_page", "error", `Page ${page.pageNumber} failed: ${error?.message || "unknown error"}`);
      const isAIError = error?.message?.includes("429") ||
        error?.message?.includes("quota") ||
        error?.message?.includes("AI request failed");

      await prisma.cataloguePage.update({
        where: { id: page.id },
        data: { status: "FAILED" },
      });

      if (isAIError) {
        await prisma.catalogue.update({
          where: { id: catalogueId },
          data: {
            status: "FAILED",
            errorMessage: `AI quota exceeded on page ${page.pageNumber}. All API keys exhausted.`,
          },
        });
        addLog("quota", "error", `AI quota exhausted on page ${page.pageNumber}, stopping`);
        console.error(`Stopping catalogue ${catalogueId}: AI quota exhausted`);
        return;
      }
    }
  }

  await prisma.catalogue.update({
    where: { id: catalogueId },
    data: {
      status: "REVIEW",
      processedPages,
      productCount: totalProducts,
      offerCount: totalOffers,
      aiProcessingProgress: 1,
    },
  });
  addLog(
    "complete",
    "completed",
    `Done: ${processedPages}/${totalPages} pages, ${totalProducts} products, ${totalOffers} offers`
  );
}
