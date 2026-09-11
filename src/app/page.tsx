import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";

export const revalidate = 3600;

export const metadata = {
  title: "Catalogue Marjane - Promotions et Offres au Maroc",
  description:
    "Découvrez le catalogue Marjane : promotions, offres et bons plans sur l'électroménager, l'alimentation, la maison et plus au Maroc.",
  openGraph: {
    title: "Catalogue Marjane - Promotions et Offres au Maroc",
    description: "Découvrez le catalogue Marjane : promotions, offres et bons plans sur l'électroménager, l'alimentation, la maison et plus au Maroc.",
    type: "website",
    url: "/",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Catalogue Marjane - Promotions et Offres",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalogue Marjane - Promotions et Offres au Maroc",
    description: "Découvrez le catalogue Marjane : promotions, offres et bons plans sur l'électroménager, l'alimentation, la maison et plus au Maroc.",
    images: ["/opengraph-image"],
  },
};

export default async function HomePage() {
  const currentCatalogues = await prisma.catalogue.findMany({
    where: {
      status: { in: ["PUBLISHED", "REVIEW"] },
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { startDate: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      slug: true,
      store: true,
      startDate: true,
      endDate: true,
      pageCount: true,
      offerCount: true,
      productCount: true,
      pages: {
        select: { imagePath: true },
        where: { pageNumber: 1 },
        take: 1,
      },
    },
  });

  const recentArticles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 6,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      primaryKeyword: true,
      publishedAt: true,
    },
  });

  const now = new Date();

  const categoryNamesWithOffers = await prisma.product.findMany({
    where: {
      offers: {
        some: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
    },
    distinct: ["category"],
    select: { category: true },
  });

  const validCategoryNames = categoryNamesWithOffers.map((p) => p.category);

  const categories = await prisma.category.findMany({
    where: {
      name: { in: validCategoryNames },
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-blue-600 via-blue-600 to-blue-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
            </div>
            <span className="text-sm font-medium text-white/80">Marjane Maroc</span>
          </div>
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
            Catalogue Marjane
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Toutes les promotions et offres Marjane au Maroc — électroménager, alimentation, maison, high-tech
          </p>
          <div className="flex gap-4 mt-8">
            <Link
              href="/catalogue-marjane"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              Voir les catalogues
            </Link>
            <Link
              href="/promotions-marjane"
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
              Voir les promotions
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {currentCatalogues.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Catalogues en cours</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentCatalogues.map((catalogue) => {
                const img = catalogue.pages[0]?.imagePath;
                const imageUrl = img?.includes("uploads/") ? "/" + img.slice(img.indexOf("uploads/")) : img;
                return (
                  <Link
                    key={catalogue.id}
                    href={`/catalogue-marjane/${catalogue.slug}`}
                    className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300"
                  >
                    {imageUrl && (
                      <div className="bg-gray-100 h-48 overflow-hidden">
                        <img
                          src={imageUrl}
                          alt={catalogue.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-1">
                        {catalogue.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
                          {catalogue.store}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                          En cours
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                        {formatDateRange(catalogue.startDate, catalogue.endDate)}
                      </p>
                      <div className="flex gap-4 mt-3 text-xs text-gray-400">
                        <span>{catalogue.pageCount} pages</span>
                        <span>{catalogue.offerCount} offres</span>
                        <span>{catalogue.productCount} produits</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-gray-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Catégories</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat.name);
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-gray-700 hover:text-blue-600"
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm">{cat.name}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {recentArticles.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 rounded-lg p-2">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Articles et conseils</h2>
              </div>
              <Link href="/articles" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Tout voir
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="group bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      {article.primaryKeyword || "Conseil"}
                    </span>
                    {article.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(article.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-gray-500 line-clamp-2 mt-2">
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
          </section>
        )}

        <section className="bg-white border border-gray-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 rounded-lg p-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Catalogue Marjane Maroc</h2>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Retrouvez tous les catalogues Marjane avec les meilleures promotions du moment.
            Électroménager, alimentation, maison, high-tech et bien plus encore.
            Consultez les offres en cours, comparez les prix et trouvez les bons plans Marjane chaque semaine.
          </p>
        </section>
      </main>
    </div>
  );
}