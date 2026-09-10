import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeFileHash } from "@/services/pdf";
import { generateCatalogueSlug } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const catalogues = await prisma.catalogue.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        paused: true,
        startDate: true,
        endDate: true,
        pageCount: true,
        processedPages: true,
        productCount: true,
        offerCount: true,
        articleCount: true,
        aiProcessingProgress: true,
        createdAt: true,
      },
    });

    return NextResponse.json(catalogues);
  } catch (error) {
    console.error("Error fetching catalogues:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalogues" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File;
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const description = (formData.get("description") as string) || null;
    const sourceUrl = (formData.get("sourceUrl") as string) || null;
    const language = (formData.get("language") as string) || "fr";

    if (!file || !title || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfHash = await computeFileHash(buffer);

    const existing = await prisma.catalogue.findUnique({
      where: { pdfHash },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This catalogue has already been uploaded" },
        { status: 409 }
      );
    }

    const slug = generateCatalogueSlug(
      title,
      new Date(startDate),
      new Date(endDate)
    );

    const catalogue = await prisma.catalogue.create({
      data: {
        title,
        slug,
        description,
        type: type as any,
        language,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        sourceUrl,
        pdfHash,
        status: "UPLOADED",
      },
    });

    const uploadDir = path.join(
      process.env.UPLOAD_DIR || "./uploads",
      catalogue.id
    );
    await mkdir(uploadDir, { recursive: true });
    const pdfPath = path.join(uploadDir, "catalogue.pdf");
    await writeFile(pdfPath, buffer);

    await prisma.catalogue.update({
      where: { id: catalogue.id },
      data: { pdfPath },
    });

    return NextResponse.json(catalogue, { status: 201 });
  } catch (error) {
    console.error("Error creating catalogue:", error);
    return NextResponse.json(
      { error: "Failed to create catalogue" },
      { status: 500 }
    );
  }
}
