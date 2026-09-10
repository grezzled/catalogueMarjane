import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { PAGE_ANALYSIS_PROMPT } from "@/ai/prompts";
import { imageToBase64 } from "@/services/pdf";
import { cropProductImage } from "@/services/cropping";
import { normalizeProductName } from "@/services/categories";
import { extractJsonFromAIResponse } from "@/lib/utils";
import type { PageAnalysis } from "@/types";
import { dirname } from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  try {
    const { pageId } = await params;

    const page = await prisma.cataloguePage.findUnique({
      where: { id: pageId },
      include: { catalogue: true },
    });

    if (!page || !page.imagePath) {
      return NextResponse.json({ error: "Page not found or no image" }, { status: 404 });
    }

    const provider = await AIProviderFactory.create(
      process.env.AI_PROVIDER || "gemini",
      process.env as Record<string, string | undefined>
    );

    const imageBase64 = await imageToBase64(page.imagePath);
    const textContext = page.extractedText
      ? `\n\nExtracted text from PDF:\n${page.extractedText}`
      : "";

    const response = await provider.analyzeImage(
      imageBase64,
      PAGE_ANALYSIS_PROMPT + textContext
    );

    const analysis = extractJsonFromAIResponse(response) as PageAnalysis;
    const products = analysis.products || [];
    const productsDir = `${dirname(page.imagePath)}/../products`;

    let cropped = 0;
    for (const product of products) {
      if (!product.boundingBox) continue;

      const normalizedName = normalizeProductName(product.name);
      const dbProduct = await prisma.product.findFirst({
        where: { normalizedName },
      });

      if (!dbProduct || dbProduct.imageUrl) continue;

      const outputPath = `${productsDir}/${dbProduct.id}-page${page.pageNumber}.jpg`;
      const result = await cropProductImage(page.imagePath, product.boundingBox, outputPath);
      if (result) {
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { imageUrl: result },
        });
        cropped++;
      }
    }

    return NextResponse.json({ success: true, cropped, total: products.length });
  } catch (error) {
    console.error("Crop images error:", error);
    return NextResponse.json({ error: "Failed to crop images" }, { status: 500 });
  }
}
