import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogues = await prisma.catalogue.findMany({
    select: {
      slug: true,
      updatedAt: true,
      pages: {
        select: {
          pageNumber: true,
          updatedAt: true,
        },
      },
    },
  });

  const cataloguePages: MetadataRoute.Sitemap = [];

  for (const catalogue of catalogues) {
    cataloguePages.push({
      url: `${BASE_URL}/catalogue-marjane/${catalogue.slug}`,
      lastModified: catalogue.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    });

    for (const page of catalogue.pages) {
      cataloguePages.push({
        url: `${BASE_URL}/catalogue-marjane/${catalogue.slug}/page/${page.pageNumber}`,
        lastModified: page.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
  });

  const articlePages: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${BASE_URL}/articles/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/catalogue-marjane`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/promotions-marjane`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...cataloguePages,
    ...articlePages,
  ];
}