import { revalidatePath } from "next/cache";
import { pingGoogleIndexing } from "@/services/indexing";
import { prisma } from "@/lib/prisma";
import { writeSitemapFile } from "@/services/sitemap-file";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://cataloguemarjane.com";

/**
 * Best-effort rewrite of public/sitemap.xml (writable disk only;
 * ignored on read-only hosts). Keeps the static sitemap file fresh
 * without a rebuild.
 */
function refreshSitemapFile(): void {
  writeSitemapFile(prisma).catch((err) => {
    console.error("Sitemap file refresh failed:", err);
  });
}

export function revalidateSite() {
  revalidatePath("/");
  revalidatePath("/catalogue-marjane");
  revalidatePath("/promotions-marjane");
  revalidatePath("/articles");
  refreshSitemapFile();
}

export async function publishCatalogue(slug: string): Promise<void> {
  revalidatePath(`/catalogue-marjane/${slug}`);
  revalidatePath("/catalogue-marjane");
  revalidatePath("/");
  revalidatePath("/promotions-marjane");
  refreshSitemapFile();

  const url = `${BASE_URL}/catalogue-marjane/${slug}`;
  await pingGoogleIndexing(url);
}

/** Revalidate a catalogue detail page + lists, without pinging Google. */
export function revalidateCatalogue(slug: string): void {
  revalidatePath(`/catalogue-marjane/${slug}`);
  revalidateSite();
}

/** Revalidate an article page + lists, without pinging Google. */
export function revalidateArticle(slug: string): void {
  revalidatePath(`/articles/${slug}`);
  revalidateSite();
}
