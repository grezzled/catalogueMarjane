import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return articles.map((a) => ({ slug: a.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      title: true,
      metaTitle: true,
      metaDescription: true,
      slug: true,
    },
  });

  if (!article) return { title: "Article non trouvé" };

  return {
    title: article.metaTitle || article.title,
    description: article.metaDescription,
    alternates: {
      canonical: `/articles/${article.slug}`,
    },
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDescription || undefined,
      type: "article",
    },
  };
}

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  // Handle absolute paths from the server
  if (imagePath.includes('/public/uploads/')) {
    const uploadsIdx = imagePath.indexOf('/public/uploads/');
    return imagePath.slice(uploadsIdx + 7); // Remove /public prefix
  }
  if (imagePath.includes('uploads/')) {
    const uploadsIdx = imagePath.indexOf('uploads/');
    return '/' + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

function renderContent(content: string): string {
  let html = content;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-extrabold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-extrabold text-gray-900 mt-10 mb-4">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');

  // Tables - collect all table rows first (process BEFORE images)
  const tableRows: string[] = [];
  let inTableBlock = false;
  const linesForTable = html.split('\n');
  const processedLines: string[] = [];

  function convertImagePath(src: string): string {
    if (src.includes('/public/uploads/')) {
      return src.slice(src.indexOf('/public/uploads/') + 7);
    }
    if (src.includes('uploads/')) {
      return '/' + src.slice(src.indexOf('uploads/'));
    }
    return src;
  }

  function makeTableImage(src: string, alt: string): string {
    const imageSrc = convertImagePath(src);
    return `<div class="flex items-center"><img src="${imageSrc}" alt="${alt}" class="w-12 h-12 object-contain rounded" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-12 h-12 bg-gray-100 rounded items-center justify-center hidden"><svg class="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
  }

  for (const line of linesForTable) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTableBlock = true;
      tableRows.push(line.trim());
    } else {
      if (inTableBlock && tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(2);

        const headerCells = headerRow.split('|').filter(c => c.trim()).map(c =>
          `<th class="px-3 py-2 bg-gray-50 border border-gray-200 text-left font-bold text-gray-900 text-xs">${c.trim()}</th>`
        ).join('');

        const rowsHtml = dataRows.map(row => {
          const cells = row.split('|').filter(c => c.trim()).map(c => {
            let cellContent = c.trim();
            // Convert markdown images to small table images
            cellContent = cellContent.replace(/!\[(.+?)\]\((.+?)\)/g, (_, alt, src) => makeTableImage(src, alt));
            // Handle bare image URLs
            if (cellContent.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              cellContent = makeTableImage(cellContent, 'Product');
            }
            return `<td class="px-3 py-2 border border-gray-200 text-xs">${cellContent}</td>`;
          }).join('');
          return `<tr class="hover:bg-gray-50">${cells}</tr>`;
        }).join('');

        processedLines.push(`<div class="overflow-x-auto my-4"><table class="w-full border-collapse rounded-lg overflow-hidden shadow-sm text-xs"><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
        tableRows.length = 0;
      }
      inTableBlock = false;
      processedLines.push(line);
    }
  }

  if (tableRows.length > 0) {
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(2);

    const headerCells = headerRow.split('|').filter(c => c.trim()).map(c =>
      `<th class="px-3 py-2 bg-gray-50 border border-gray-200 text-left font-bold text-gray-900 text-xs">${c.trim()}</th>`
    ).join('');

    const rowsHtml = dataRows.map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => {
        let cellContent = c.trim();
        cellContent = cellContent.replace(/!\[(.+?)\]\((.+?)\)/g, (_, alt, src) => makeTableImage(src, alt));
        if (cellContent.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          cellContent = makeTableImage(cellContent, 'Product');
        }
        return `<td class="px-3 py-2 border border-gray-200 text-xs">${cellContent}</td>`;
      }).join('');
      return `<tr class="hover:bg-gray-50">${cells}</tr>`;
    }).join('');

    processedLines.push(`<div class="overflow-x-auto my-4"><table class="w-full border-collapse rounded-lg overflow-hidden shadow-sm text-xs"><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
  }

  html = processedLines.join('\n');

  // Images (AFTER tables - only converts images outside tables)
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, (match, alt, src) => {
    const imageSrc = convertImagePath(src);
    return `<div class="my-4"><img src="${imageSrc}" alt="${alt}" class="w-full h-auto rounded-lg shadow-sm" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-full h-24 bg-gray-100 rounded-lg items-center justify-center hidden"><svg class="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
  });

  // Links (AFTER images - so image markdown is not affected)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-700 underline">$1</a>');

  // Lists

  // Paragraphs and line breaks
  const finalLines = html.split('\n');
  let inList = false;
  let inTable = false;
  const result: string[] = [];

  for (const line of finalLines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('<li')) {
      if (!inList) {
        result.push('<ul class="space-y-2 my-4">');
        inList = true;
      }
      result.push(line);
    } else if (trimmed.startsWith('<h') || trimmed.startsWith('<tr')) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed.startsWith('<tr') && !inTable) {
        result.push('<table class="w-full border-collapse my-4">');
        inTable = true;
      } else if (trimmed.startsWith('<tr') && inTable) {
        // continue table
      } else if (inTable && !trimmed.startsWith('<tr')) {
        result.push('</table>');
        inTable = false;
      }
      result.push(line);
    } else if (trimmed === '') {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inTable) {
        result.push('</table>');
        inTable = false;
      }
    } else if (trimmed && !trimmed.startsWith('<')) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inTable) {
        result.push('</table>');
        inTable = false;
      }
      result.push(`<p class="text-gray-700 leading-relaxed my-3">${trimmed}</p>`);
    } else {
      result.push(line);
    }
  }

  if (inList) result.push('</ul>');
  if (inTable) result.push('</table>');

  return result.join('\n');
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      catalogue: {
        select: {
          id: true,
          title: true,
          slug: true,
          pages: {
            orderBy: { pageNumber: "asc" },
            select: { pageNumber: true, category: true, imagePath: true },
          },
        },
      },
      articleCategories: {
        include: { category: { select: { name: true, slug: true } } },
      },
    },
  });

  if (!article || article.status !== "PUBLISHED") notFound();

  const relatedArticles = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: article.id },
      OR: [
        { primaryKeyword: article.primaryKeyword },
        {
          articleCategories: {
            some: {
              categoryId: {
                in: article.articleCategories.map((ac) => ac.categoryId),
              },
            },
          },
        },
      ],
    },
    take: 3,
    select: { id: true, title: true, slug: true, excerpt: true },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    url: `/articles/${article.slug}`,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      "@type": "Organization",
      name: "Catalogue Marjane",
    },
  };

  const renderedContent = renderContent(article.content);

  const catalogueFirstPage = article.catalogue?.pages?.[0]?.imagePath;
  const catalogueImageUrl = toImageUrl(catalogueFirstPage || null);

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <nav className="text-sm text-blue-200/70 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <Link href="/articles" className="hover:text-white transition-colors">Articles</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-white font-medium truncate max-w-[200px]">{article.title}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 mt-4">
            {article.publishedAt && (
              <span className="text-blue-200 text-sm flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                {new Date(article.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
          {article.articleCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {article.articleCategories.map((ac) => (
                <Link
                  key={ac.categoryId}
                  href={`/category/${ac.category.slug}`}
                  className="text-xs bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full hover:bg-white/30 transition-colors font-medium"
                >
                  {ac.category.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <article
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 md:p-10"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          </div>

          <aside className="space-y-6">
            {article.catalogue && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-100 rounded-lg p-2">
                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125-1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </div>
                  <h2 className="font-bold text-gray-900">Catalogue associé</h2>
                </div>
                {catalogueImageUrl && (
                  <div className="bg-gray-100 rounded-xl overflow-hidden mb-4">
                    <img
                      src={catalogueImageUrl}
                      alt={article.catalogue.title}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <Link
                  href={`/catalogue-marjane/${article.catalogue.slug}`}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  {article.catalogue.title}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </Link>
              </div>
            )}

            {relatedArticles.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 rounded-lg p-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6z" /></svg>
                  </div>
                  <h2 className="font-bold text-gray-900">Articles connexes</h2>
                </div>
                <div className="space-y-4">
                  {relatedArticles.map((ra) => (
                    <Link
                      key={ra.id}
                      href={`/articles/${ra.slug}`}
                      className="group block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-sm leading-snug">
                        {ra.title}
                      </h3>
                      {ra.excerpt && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {ra.excerpt}
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
                        Lire
                        <svg className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}