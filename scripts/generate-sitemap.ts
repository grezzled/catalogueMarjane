/**
 * Regenerate public/sitemap.xml directly from the SQLite database.
 *
 * No `next build`, no running Next.js server required:
 *   npm run sitemap
 *   npx tsx scripts/generate-sitemap.ts
 *   APP_URL=https://cataloguemarjane.com npx tsx scripts/generate-sitemap.ts
 *
 * Run it manually, from cron, or after publishing a catalogue.
 * The catalogue worker also calls it automatically (hourly + on expiry).
 */
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { writeSitemapFile } from "../src/services/sitemap-file";

// tsx does not load .env automatically (unlike `next`), so do it here
// for manual runs and cron. No new dependency needed.
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
    const baseUrl =
      process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || undefined;
    const { path, urlCount } = await writeSitemapFile(prisma, { baseUrl });
    console.log(`Sitemap written: ${path} (${urlCount} URLs)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Sitemap generation failed:", error);
  process.exit(1);
});
