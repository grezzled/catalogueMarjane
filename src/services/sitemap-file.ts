import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { PrismaClient } from "@prisma/client";
import { getActiveDeals } from "@/lib/deals";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toIso(date: Date | string): string {
  return new Date(date).toISOString();
}

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

export async function buildSitemapUrls(
  prisma: PrismaClient,
  baseUrl: string
): Promise<SitemapUrl[]> {
  const now = new Date();

  const publishedCatalogues = await prisma.catalogue.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true, endDate: true },
    orderBy: { startDate: "desc" },
  });

  const activeCatalogues = publishedCatalogues.filter(
    (c) => new Date(c.endDate) >= now
  );
  const latestSlug =
    activeCatalogues.length > 0
      ? activeCatalogues[0].slug
      : publishedCatalogues[0]?.slug;

  const urls: SitemapUrl[] = [
    { loc: baseUrl, lastmod: now.toISOString(), changefreq: "daily", priority: 1 },
    { loc: `${baseUrl}/catalogue-marjane`, lastmod: now.toISOString(), changefreq: "daily", priority: 0.9 },
    { loc: `${baseUrl}/promotions-marjane`, lastmod: now.toISOString(), changefreq: "daily", priority: 0.9 },
    { loc: `${baseUrl}/produits`, lastmod: now.toISOString(), changefreq: "daily", priority: 0.9 },
    { loc: `${baseUrl}/articles`, lastmod: now.toISOString(), changefreq: "weekly", priority: 0.7 },
    { loc: `${baseUrl}/a-propos`, lastmod: now.toISOString(), changefreq: "monthly", priority: 0.5 },
    { loc: `${baseUrl}/conditions-utilisation`, lastmod: now.toISOString(), changefreq: "yearly", priority: 0.3 },
    { loc: `${baseUrl}/politique-confidentialite`, lastmod: now.toISOString(), changefreq: "yearly", priority: 0.3 },
  ];

  // Active catalogues rank high; expired (archive) stay accessible but demoted.
  for (const catalogue of publishedCatalogues) {
    const isExpired = new Date(catalogue.endDate) < now;
    urls.push(
      isExpired
        ? {
            loc: `${baseUrl}/catalogue-marjane/${catalogue.slug}`,
            lastmod: toIso(catalogue.updatedAt),
            changefreq: "yearly",
            priority: 0.3,
          }
        : {
            loc: `${baseUrl}/catalogue-marjane/${catalogue.slug}`,
            lastmod: toIso(catalogue.updatedAt),
            changefreq: catalogue.slug === latestSlug ? "daily" : "weekly",
            priority: catalogue.slug === latestSlug ? 1.0 : 0.8,
          }
    );
  }

  const categories = await prisma.category.findMany({
    select: { slug: true, updatedAt: true },
  });
  for (const cat of categories) {
    urls.push({
      loc: `${baseUrl}/category/${cat.slug}`,
      lastmod: toIso(cat.updatedAt),
      changefreq: "weekly",
      priority: 0.8,
    });
  }

  // Deal collections only exist when they clear the data threshold —
  // thin pages never reach the sitemap.
  const activeDeals = await getActiveDeals(prisma);
  for (const { deal } of activeDeals) {
    urls.push({
      loc: `${baseUrl}/promotions-marjane/${deal.slug}`,
      lastmod: now.toISOString(),
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
  });
  for (const article of articles) {
    urls.push({
      loc: `${baseUrl}/articles/${article.slug}`,
      lastmod: toIso(article.updatedAt),
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  // Product pages with at least one published offer (price history).
  // Single-offer products still qualify: the page is a valid offer landing.
  const products = await prisma.product.findMany({
    where: { offers: { some: { catalogue: { status: "PUBLISHED" } } } },
    select: { slug: true, updatedAt: true },
  });
  for (const product of products) {
    if (!product.slug) continue;
    urls.push({
      loc: `${baseUrl}/produit/${product.slug}`,
      lastmod: toIso(product.updatedAt),
      changefreq: "weekly",
      priority: 0.6,
    });
  }

  return urls;
}

export function renderSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map(
      (u) => `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

/**
 * Regenerate public/sitemap.xml directly from SQLite.
 * No Next.js build, no running server required — only DB file access.
 * Safe to call from the worker, cron, or API routes (best-effort).
 */
export async function writeSitemapFile(
  prisma: PrismaClient,
  options?: { baseUrl?: string; outPath?: string }
): Promise<{ path: string; urlCount: number }> {
  const baseUrl = (
    options?.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://cataloguemarjane.com"
  ).replace(/\/$/, "");
  const outPath =
    options?.outPath || join(process.cwd(), "public", "sitemap.xml");

  const urls = await buildSitemapUrls(prisma, baseUrl);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderSitemapXml(urls), "utf-8");
  return { path: outPath, urlCount: urls.length };
}
