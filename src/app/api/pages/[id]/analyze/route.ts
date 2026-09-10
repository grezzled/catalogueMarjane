import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { PAGE_ANALYSIS_PROMPT } from "@/ai/prompts";
import { imageToBase64 } from "@/services/pdf";
import { cropProductImage } from "@/services/cropping";
import { detectCategory, detectBrand, normalizeProductName } from "@/services/categories";
import { extractJsonFromAIResponse } from "@/lib/utils";
import type { PageAnalysis } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const page = await prisma.cataloguePage.findUnique({
      where: { id },
      include: { catalogue: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const provider = await AIProviderFactory.create(
      process.env.AI_PROVIDER || "gemini",
      process.env as Record<string, string | undefined>
    );

    let analysis: PageAnalysis;

    let aiResponse: string;
    try {
      if (page.imagePath) {
        const imageBase64 = await imageToBase64(page.imagePath, page.catalogueId);
        const textContext = page.extractedText
          ? `\n\nExtracted text from PDF:\n${page.extractedText}`
          : "";
        aiResponse = await provider.analyzeImage(
          imageBase64,
          PAGE_ANALYSIS_PROMPT + textContext
        );
      } else if (page.extractedText) {
        aiResponse = await provider.generateText(
          PAGE_ANALYSIS_PROMPT + `\n\nText content of catalogue page:\n${page.extractedText}`
        );
      } else {
        return NextResponse.json({ error: "No image or text to analyze" }, { status: 400 });
      }
    } catch (aiError: any) {
      const msg = aiError?.message || String(aiError);
      console.error(`AI request failed for page ${page.pageNumber}:`, msg);
      return NextResponse.json(
        { error: `AI request failed: ${msg}` },
        { status: 500 }
      );
    }

    try {
      analysis = extractJsonFromAIResponse(aiResponse) as PageAnalysis;
    } catch (parseError: any) {
      console.error(`Failed to parse AI response for page ${page.pageNumber}:`, parseError?.message);
      return NextResponse.json(
        { error: `AI returned invalid JSON: ${aiResponse?.slice(0, 300) || "empty response"}` },
        { status: 500 }
      );
    }

    const products = analysis.products || [];
    const category = detectCategory(analysis.category || analysis.title || "");

    await prisma.cataloguePage.update({
      where: { id },
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
      const normalizedName = normalizeProductName(product.name);
      const brand = product.brand || detectBrand(product.name);

      let dbProduct = await prisma.product.findFirst({ where: { normalizedName } });
      if (!dbProduct) {
        dbProduct = await prisma.product.create({
          data: {
            name: product.name, normalizedName, brand,
            category: product.category || category,
            subcategory: product.subcategory,
            specifications: JSON.stringify(product.features),
          },
        });
      }

      if (product.boundingBox && page.imagePath && !dbProduct.imageUrl) {
        const outputPath = `${require("path").dirname(page.imagePath)}/../products/${dbProduct.id}-page${page.pageNumber}.webp`;
        try {
          const cropped = await cropProductImage(page.imagePath, product.boundingBox, outputPath, page.catalogueId);
          if (cropped) {
            await prisma.product.update({
              where: { id: dbProduct.id },
              data: { imageUrl: cropped },
            });
            console.log(`Cropped product image: ${product.name} -> ${cropped}`);
          } else {
            console.warn(`Crop returned null for: ${product.name} (boundingBox: ${JSON.stringify(product.boundingBox)})`);
          }
        } catch (cropErr) {
          console.error(`Failed to crop product ${product.name}:`, cropErr);
        }
      }

      if (product.salePrice || product.originalPrice) {
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

    return NextResponse.json({
      success: true,
      products: products.length,
      confidence: analysis.confidence,
    });
  } catch (error) {
    console.error("Page analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze page" },
      { status: 500 }
    );
  }
}