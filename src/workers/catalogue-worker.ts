import { prisma } from "@/lib/prisma";
import { extractPDFText, renderPDFPages } from "@/services/pdf";
import { processCatalogue } from "@/services/processing";
import { generateArticleForCatalogue } from "@/services/articles";
import { ensureCategoriesExist } from "@/services/categories";
import { readFile } from "fs/promises";

async function runWorker() {
  console.log("Worker started. Listening for jobs...");

  while (true) {
    try {
      const catalogue = await prisma.catalogue.findFirst({
        where: {
          status: { in: ["UPLOADED", "PROCESSING", "EXTRACTING"] },
          paused: false,
        },
        orderBy: { createdAt: "asc" },
      });

      if (!catalogue) {
        await sleep(5000);
        continue;
      }

      console.log(`Processing catalogue: ${catalogue.title}`);

      if (catalogue.status === "UPLOADED" && catalogue.pdfPath) {
        await prisma.catalogue.update({
          where: { id: catalogue.id },
          data: { status: "EXTRACTING" },
        });

        const pdfBuffer = await readFile(catalogue.pdfPath);
        const extraction = await extractPDFText(pdfBuffer);

        await prisma.catalogue.update({
          where: { id: catalogue.id },
          data: { pageCount: extraction.pageCount, status: "PROCESSING" },
        });

        for (const page of extraction.pages) {
          await prisma.cataloguePage.create({
            data: {
              catalogueId: catalogue.id,
              pageNumber: page.pageNumber,
              extractedText: page.text,
              status: "PENDING",
            },
          });
        }

        try {
          const pageImages = await renderPDFPages(
            pdfBuffer,
            catalogue.id,
            extraction.pageCount
          );
          for (const pi of pageImages) {
            await prisma.cataloguePage.updateMany({
              where: { catalogueId: catalogue.id, pageNumber: pi.pageNumber },
              data: { imagePath: pi.imagePath },
            });
          }
        } catch (err) {
          console.warn("Could not render page images:", err);
        }

        console.log(`Extracted ${extraction.pageCount} pages`);
      }

      if (
        catalogue.status === "PROCESSING" ||
        catalogue.status === "EXTRACTING"
      ) {
        await processCatalogue(catalogue.id);
        console.log("AI analysis completed");

        const pages = await prisma.cataloguePage.findMany({
          where: { catalogueId: catalogue.id },
          select: { category: true },
        });
        const cats = [...new Set(pages.map((p) => p.category).filter(Boolean))] as string[];
        if (cats.length > 0) {
          await ensureCategoriesExist(cats);
          console.log(`Ensured ${cats.length} categories exist`);
        }
      }

      if (catalogue.status === "REVIEW") {
        try {
          await generateArticleForCatalogue(catalogue.id);
          console.log("Article generated");
        } catch (err) {
          console.error("Article generation failed:", err);
        }
      }

      await sleep(2000);
    } catch (error) {
      console.error("Worker error:", error);
      await sleep(10000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runWorker();