import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { articleTypeLabel } from "@/lib/article-types";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const revalidate = 3600;

export const metadata = {
  title: "Articles et conseils Marjane - Promotions et bons plans",
  description:
    "Articles et conseils sur les promotions Marjane : meilleures offres, guides d'achat et bons plans au Maroc.",
  openGraph: {
    title: "Articles et conseils Marjane - Promotions et bons plans",
    description: "Articles et conseils sur les promotions Marjane : meilleures offres, guides d'achat et bons plans au Maroc.",
    type: "website",
    url: "/articles",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Articles Marjane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Articles et conseils Marjane - Promotions et bons plans",
    description: "Articles et conseils sur les promotions Marjane : meilleures offres, guides d'achat et bons plans au Maroc.",
    images: ["/api/og"],
  },
};

export default async function ArticlesListPage() {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      primaryKeyword: true,
      articleType: true,
      articleFocus: true,
      publishedAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Articles", url: "/articles" },
        ]}
      />
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <nav className="text-sm text-blue-200/70 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-white font-medium">Articles</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6z" /></svg>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">Articles et conseils</h1>
              <p className="text-blue-200 mt-1">
                Guides, comparatifs et conseils pour profiter des promotions Marjane
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <p className="text-gray-500 text-lg">Aucun article publié pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="group bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {articleTypeLabel(article.articleType)}
                    {article.articleFocus ? ` — ${article.articleFocus}` : ""}
                  </span>
                  <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {article.primaryKeyword || "Conseil"}
                  </span>
                  {article.publishedAt && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                      {new Date(article.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="text-sm text-gray-500 line-clamp-3 mt-2">
                    {article.excerpt}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 mt-4 text-xs text-blue-600 font-medium group-hover:text-blue-700">
                  Lire l'article
                  <svg className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}