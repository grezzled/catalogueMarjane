/**
 * Backfill per-page editorial fields from existing page AI analysis.
 *
 *   npx tsx scripts/backfill-page-editorial.ts            # all catalogues
 *   npx tsx scripts/backfill-page-editorial.ts <id>       # one catalogue
 */
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { normalizePageEditorial } from "../src/services/page-editorial";
import type { PageAnalysis } from "../src/types";

function loadDotEnv(): void {
  const path = `${process.cwd()}/.env`;
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(trimmed.indexOf("=") + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

async function main() {
  const prisma = new PrismaClient();
  const catalogueId = process.argv[2];
  let updated = 0;
  let skipped = 0;
  try {
    const pages = await prisma.cataloguePage.findMany({
      where: {
        ...(catalogueId ? { catalogueId } : {}),
        aiAnalysis: { not: null },
        OR: [
          { editorialTitle: null },
          { editorialSummary: null },
          { imageAlt: null },
        ],
      },
      select: {
        id: true,
        pageNumber: true,
        aiAnalysis: true,
      },
      orderBy: { pageNumber: "asc" },
    });

    for (const page of pages) {
      if (!page.aiAnalysis) {
        skipped++;
        continue;
      }
      try {
        const analysis = JSON.parse(page.aiAnalysis) as PageAnalysis;
        const editorial = normalizePageEditorial(analysis, page.pageNumber);
        await prisma.cataloguePage.update({
          where: { id: page.id },
          data: {
            editorialTitle: editorial.title,
            editorialSummary: editorial.summary,
            imageAlt: editorial.imageAlt,
          },
        });
        updated++;
        console.log(`  Page ${page.pageNumber}: ${editorial.title}`);
      } catch (error) {
        skipped++;
        console.error(`  Page ${page.pageNumber}: skipped (${error instanceof Error ? error.message : "invalid analysis"})`);
      }
    }
    console.log(`Done — ${updated} page(s) updated, ${skipped} skipped.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
