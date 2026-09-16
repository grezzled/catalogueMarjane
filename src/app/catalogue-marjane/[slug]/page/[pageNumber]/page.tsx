import { notFound, redirect, RedirectType } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ slug: string; pageNumber: string }>;
}

/**
 * Legacy standalone catalogue pages are gone — the catalogue detail page
 * embeds the interactive viewer instead. Old /page/N URLs (articles,
 * Google index, external links) 301-redirect to the viewer opened on
 * that page via the #page-N anchor.
 */
export default async function CataloguePageRedirect({ params }: Props) {
  const { slug, pageNumber } = await params;
  const pageNum = parseInt(pageNumber, 10);
  if (isNaN(pageNum) || pageNum < 1) notFound();

  const catalogue = await prisma.catalogue.findUnique({
    where: { slug },
    select: { slug: true },
  });
  if (!catalogue) notFound();

  redirect(`/catalogue-marjane/${slug}#page-${pageNum}`, RedirectType.replace);
}
