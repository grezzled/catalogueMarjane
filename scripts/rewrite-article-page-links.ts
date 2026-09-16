/**
 * Rewrite legacy standalone catalogue-page links in articles to anchors.
 *
 *   /catalogue-marjane/{slug}/page/8  →  /catalogue-marjane/{slug}#page-8
 *   /catalogue-marjane/{slug}/8       →  /catalogue-marjane/{slug}#page-8
 *
 * The standalone /page/[pageNumber] route is gone (301 → catalogue anchor),
 * so every article "Voir page X" link must use the anchor form, which the
 * in-page explorer understands (#page-N opens that page).
 *
 *   npx tsx scripts/rewrite-article-page-links.ts            # dry run
 *   npx tsx scripts/rewrite-article-page-links.ts --apply    # write to DB
 *
 * Article pages revalidate hourly (ISR 3600), so rewritten links go live
 * on their own. Force-refresh sooner via POST /api/revalidate if needed.
 */
import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

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

/** Returns [rewritten, replacements]. Order matters: /page/page/N first. */
function rewritePageLinks(text: string): [string, number] {
  let count = 0;
  // Doubled prefix left by the old fixer: .../page/page/5 → ...#page-5
  let out = text.replace(
    /\/catalogue-marjane\/([^)\s"']+?)\/page\/page\/(\d+)/g,
    (_m, slug, pageNum) => {
      count++;
      return `/catalogue-marjane/${slug}#page-${pageNum}`;
    }
  );
  out = out.replace(
    /\/catalogue-marjane\/([^)\s"']+?)\/page\/(\d+)/g,
    (_m, slug, pageNum) => {
      count++;
      return `/catalogue-marjane/${slug}#page-${pageNum}`;
    }
  );
  out = out.replace(
    /\/catalogue-marjane\/([^)\s"']+?)\/(\d+)(?=[)\s"'.!,]|$)/g,
    (_m, slug, pageNum) => {
      count++;
      return `/catalogue-marjane/${slug}#page-${pageNum}`;
    }
  );
  return [out, count];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const articles = await prisma.article.findMany({
      select: { id: true, title: true, slug: true, content: true, faq: true },
    });
    let touched = 0;
    let total = 0;
    for (const a of articles) {
      const [content, c1] = rewritePageLinks(a.content || "");
      const [faq, c2] = rewritePageLinks(a.faq || "");
      if (c1 + c2 === 0) continue;
      touched++;
      total += c1 + c2;
      console.log(`- "${a.title}" (${a.slug}): ${c1 + c2} link(s) [content: ${c1}, faq: ${c2}]`);
      if (apply) {
        await prisma.article.update({
          where: { id: a.id },
          data: { content, faq },
        });
      }
    }
    console.log(
      apply
        ? `\nRewrote ${total} link(s) across ${touched} article(s).`
        : `\nDry run: ${total} link(s) across ${touched} article(s) would be rewritten. Re-run with --apply.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Rewrite failed:", error);
  process.exit(1);
});
