/**
 * Generate grounded French editorial intros for catalogues missing one.
 *
 *   npm run editorial              # all catalogues without description
 *   npm run editorial -- <id>       # single catalogue
 *
 * Uses DB facts only (prices/names verified before saving).
 */
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { generateEditorialForCatalogue } from "../src/services/editorial";

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
  try {
    const onlyId = process.argv[2];
    const catalogues = onlyId
      ? await prisma.catalogue.findMany({ where: { id: onlyId }, select: { id: true, title: true } })
      : await prisma.catalogue.findMany({
          where: { OR: [{ description: null }, { description: "" }] },
          select: { id: true, title: true },
        });
    if (catalogues.length === 0) {
      console.log("Nothing to do — all catalogues have an editorial text.");
      return;
    }
    for (const c of catalogues) {
      console.log(`Generating editorial for "${c.title}"…`);
      const result = await generateEditorialForCatalogue(c.id);
      if (result.success) {
        console.log(`  OK (price check: ${result.checks?.checkedProducts} products, score ${result.checks?.priceScore})`);
      } else {
        console.error(`  FAILED: ${result.error}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Editorial generation failed:", error);
  process.exit(1);
});
