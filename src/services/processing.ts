import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { PAGE_ANALYSIS_PROMPT } from "@/ai/prompts";
import { imageToBase64 } from "@/services/pdf";
import { cropProductImage } from "@/services/cropping";
import {
  detectCategory,
  detectBrand,
  normalizeProductName,
} from "@/services/categories";
import { extractJsonFromAIResponse } from "@/lib/utils";
import type { PageAnalysis } from "@/types";

export async function processCatalogue(catalogueId: string): Promise<void> {
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

  for (const page of catalogue.pages) {
    const current = await prisma.catalogue.findUnique({ where: { id: catalogueId }, select: { paused: true } });
    if (current?.paused) {
      console.log(`Catalogue ${catalogueId} paused, stopping`);
      return;
    }

    if (page.status === "COMPLETED" && page.aiAnalysis) {
      processedPages++;
      continue;
    }

    try {
      await prisma.cataloguePage.update({
        where: { id: page.id },
        data: { status: "PROCESSING" },
      });

      let analysis: PageAnalysis;

      if (page.imagePath) {
        const imageBase64 = await imageToBase64(page.imagePath);
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
        const normalizedName = normalizeProductName(product.name);
        const brand =
          product.brand || detectBrand(product.name);

        let dbProduct = await prisma.product.findFirst({
          where: { normalizedName },
        });

        if (!dbProduct) {
          dbProduct = await prisma.product.create({
            data: {
              name: product.name,
              normalizedName,
              brand,
              category: product.category || category,
              subcategory: product.subcategory,
              specifications: JSON.stringify(product.features),
            },
          });
        }

        if (product.boundingBox && page.imagePath && !dbProduct.imageUrl) {
          const outputPath = `${require("path").dirname(page.imagePath)}/../products/${dbProduct.id}-page${page.pageNumber}.jpg`;
          try {
            const cropped = await cropProductImage(page.imagePath, product.boundingBox, outputPath);
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
    } catch (error: any) {
      console.error(`Error processing page ${page.pageNumber}:`, error);
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
}

function extractProductsFromText(text: string): PageAnalysis["products"] {
  if (!text) return [];
  const products: PageAnalysis["products"] = [];
  const lines = text.split("\n").filter((l) => l.trim().length > 2);
  const priceRegex = /(\d+[\.,]\d+)\s*(?:dh|Dh|DH|MAD)?/gi;
  const nameRegex = /^([A-Za-zÀ-ÿ\s\-]+(?:\d+[a-z]*|[a-z]*\d+)?)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const priceMatch = line.match(priceRegex);
    if (priceMatch) {
      const name = line.replace(priceRegex, "").trim();
      const price = parseFloat(priceMatch[0].replace(",", ".").replace(/[^\d.]/g, ""));
      if (name && name.length > 1 && !isNaN(price) && price > 0) {
        products.push({
          name,
          brand: null,
          category: "Other",
          subcategory: null,
          originalPrice: null,
          salePrice: price,
          currency: "MAD",
          discountAmount: null,
          discountPercentage: null,
          installment: null,
          features: [],
          availabilityText: null,
          confidence: 0.3,
        });
      }
    }
  }

  return products;
}
