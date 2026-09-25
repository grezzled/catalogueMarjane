import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { computeFileHash } from "@/services/pdf";
import { generateCatalogueSlug } from "@/lib/utils";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidateSite } from "@/lib/revalidate";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const catalogues = await prisma.catalogue.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        store: true,
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
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Upload too large or unreadable — proxy body limit may be exceeded (see proxyClientMaxBodySize, max ~60MB)",
        },
        { status: 413 }
      );
    }
    const file = formData.get("pdf") as File;
    const title = formData.get("title") as string;
    const store = (formData.get("store") as string) || "marjane";
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

    const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json(
        { error: `PDF exceeds ${maxMb}MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 413 }
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
        store,
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

    revalidateSite();

    return NextResponse.json(catalogue, { status: 201 });
  } catch (error) {
    console.error("Error creating catalogue:", error);
    return NextResponse.json(
      { error: "Failed to create catalogue" },
      { status: 500 }
    );
  }
}
