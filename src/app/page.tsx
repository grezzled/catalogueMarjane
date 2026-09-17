import Link from "next/link";
import { Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { getActiveDeals } from "@/lib/deals";
import { articleTypeLabel } from "@/lib/article-types";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import OfferCard from "@/app/promotions-marjane/offer-card";
import ProductCard from "@/components/product-card";
import { getMostFollowedProducts, getTrendingProducts } from "@/services/products";
import RecentlyViewedLoader from "@/components/recently-viewed-loader";

export const revalidate = 300;

export const metadata = {
  title: "Catalogue Marjane - Promotions et Offres au Maroc",
  description:
    "Consultez le catalogue Marjane de la semaine : promotions, offres et bons plans sur l'électroménager, l'alimentation et la maison au Maroc.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Catalogue Marjane - Promotions et Offres au Maroc",
    description: "Consultez le catalogue Marjane de la semaine : promotions, offres et bons plans sur l'électroménager, l'alimentation et la maison au Maroc.",
    type: "website",
    url: "/",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Catalogue Marjane - Promotions et Offres",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalogue Marjane - Promotions et Offres au Maroc",
    description: "Consultez le catalogue Marjane de la semaine : promotions, offres et bons plans sur l'électroménager, l'alimentation et la maison au Maroc.",
    images: ["/api/og"],
  },
};

export default async function HomePage() {
  const currentCatalogues = await prisma.catalogue.findMany({
    where: {
      status: "PUBLISHED",
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
      offers: {
        select: { id: true, discountPercentage: true },
      },
    },
  });

  const latestCatalogue = currentCatalogues.length > 0 ? currentCatalogues[0] : null;

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
      articleType: true,
      articleFocus: true,
      publishedAt: true,
    },
  });

  const now = new Date();

  const offerInclude = {
    product: true,
    catalogue: {
      select: {
        slug: true,
        title: true,
        articles: {
          where: { status: "PUBLISHED" },
          select: { id: true, title: true, slug: true },
        },
      },
    },
    cataloguePage: {
      select: { imagePath: true, pageNumber: true, aiAnalysis: true },
    },
  } as const;

  function uniqueOffers<T extends { productId: string }>(offers: T[], take: number, exclude?: Set<string>): T[] {
    const seen = new Set<string>(exclude ?? []);
    const out: T[] = [];
    for (const o of offers) {
      if (seen.has(o.productId)) continue;
      seen.add(o.productId);
      out.push(o);
      if (out.length >= take) break;
    }
    return out;
  }

  // Biggest percentage discounts right now → "Meilleures promotions".
  const topDiscountOffers = uniqueOffers(
    await prisma.offer.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        catalogue: { status: "PUBLISHED" },
        discountPercentage: { gt: 10 },
      },
      include: offerInclude,
      orderBy: { discountPercentage: "desc" },
      take: 30,
    }),
    6
  );

  // Biggest absolute savings (DH) → "Meilleures réductions", excluding the above.
  const topSavingsOffers = uniqueOffers(
    await prisma.offer.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        catalogue: { status: "PUBLISHED" },
        discountAmount: { gt: 0 },
      },
      include: offerInclude,
      orderBy: { discountAmount: "desc" },
      take: 30,
    }),
    6,
    new Set(topDiscountOffers.map((o) => o.productId))
  );

  // Latest catalogues whatever their dates → "Catalogues récents".
  const recentCatalogues = await prisma.catalogue.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { startDate: "desc" },
    take: 7,
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
      offers: {
        select: { id: true, discountPercentage: true },
      },
    },
  });

  const categoryNamesWithOffers = await prisma.product.findMany({
    where: {
      offers: {
        some: {
          startDate: { lte: now },
          endDate: { gte: now },
          catalogue: { status: "PUBLISHED" },
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

  // Deal collections with enough live data (each ≥ threshold) — the rest
  // stay ungenerated so no thin page is ever linked.
  const activeDeals = await getActiveDeals();

  // Most-viewed product pages this week (first-party beacon). Falls back
  // to the richest price histories on fresh databases with no traffic yet.
  const trending = await getTrendingProducts(7, 8);
  const trendingFallback = trending.length === 0 ? await getMostFollowedProducts(4) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd items={[{ name: "Accueil", url: "/" }]} />
      <header className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-blue-500 text-white overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-64 -bottom-32 h-72 w-72 rounded-full bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                </div>
                <span className="text-sm font-medium text-white/80">Marjane Maroc</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">
                Catalogue Marjane
              </h1>
              <p className="text-xl text-blue-100 max-w-2xl">
                Les catalogues et promotions du moment — électroménager, alimentation, maison, high-tech
              </p>
              <div className="flex flex-wrap gap-4 mt-8">
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
              <p className="text-blue-200 text-sm mt-6">
                {currentCatalogues.length} catalogue{currentCatalogues.length !== 1 ? "s" : ""} en cours
                {" · "}{categories.length} catégorie{categories.length !== 1 ? "s" : ""}
              </p>
            </div>
            {topDiscountOffers.length > 0 && (() => {
              const top = topDiscountOffers[0];
              return (
                <Link
                  href="/promotions-marjane"
                  className="shrink-0 w-full lg:w-80 bg-white text-gray-900 rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">
                    Top promotion du moment
                  </p>
                  <p className="text-5xl font-extrabold tracking-tight text-red-600">
                    -{Math.round(top.discountPercentage ?? 0)}%
                  </p>
                  <p className="font-semibold mt-2 line-clamp-2">{top.product.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {top.originalPrice != null && (
                      <span className="line-through mr-2">{top.originalPrice.toLocaleString()} DH</span>
                    )}
                    {top.salePrice != null && (
                      <span className="font-bold text-gray-900">{top.salePrice.toLocaleString()} DH</span>
                    )}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-bold text-blue-600">
                    Voir l&apos;offre
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </span>
                </Link>
              );
            })()}
          </div>
        </div>
      </header>

      {latestCatalogue && (() => {
        const img = latestCatalogue.pages[0]?.imagePath;
        const imageUrl = img?.includes("uploads/") ? "/" + img.slice(img.indexOf("uploads/")) : img;
        const maxDiscount = latestCatalogue.offers.reduce(
          (max, o) => Math.max(max, o.discountPercentage ?? 0),
          0
        );
        return (
          <section className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 py-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm font-bold text-green-700 uppercase tracking-wide">Catalogue Marjane actuel</span>
              </div>
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                {imageUrl && (
                  <div className="w-full lg:w-96 shrink-0">
                    <Link href={`/catalogue-marjane/${latestCatalogue.slug}`}>
                      <img
                        src={imageUrl}
                        alt={latestCatalogue.title}
                        className="w-full h-64 lg:h-80 object-cover rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
                      />
                    </Link>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                    <Link href={`/catalogue-marjane/${latestCatalogue.slug}`} className="hover:text-blue-600 transition-colors">
                      {latestCatalogue.title}
                    </Link>
                  </h2>
                  <p className="text-gray-500 flex items-center gap-2 mb-4">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                    {formatDateRange(latestCatalogue.startDate, latestCatalogue.endDate)}
                  </p>
                  <div className="flex flex-wrap gap-3 mb-6">
                    <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">
                      {latestCatalogue.productCount} produits
                    </span>
                    <span className="bg-green-50 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                      {latestCatalogue.offerCount} offres
                    </span>
                    {maxDiscount > 0 && (
                      <span className="bg-red-50 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
                        Jusqu&apos;à -{maxDiscount}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/catalogue-marjane/${latestCatalogue.slug}`}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      Voir le catalogue
                    </Link>
                    <Link
                      href="/promotions-marjane"
                      className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 font-bold px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                      Voir les offres
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}



      <main className="max-w-7xl mx-auto px-4 py-12">

        {(() => {
          const showcase = recentCatalogues.filter((c) => !latestCatalogue || c.id !== latestCatalogue.id).slice(0, 6);
          if (showcase.length === 0) return null;
          return (
            <section className="mb-16">
              <div className="flex items-center justify-between gap-3 mb-8">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-gray-100 rounded-lg p-2">
                    <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Catalogues récents</h2>
                </div>
                <Link href="/catalogue-marjane" className="shrink-0 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Tout voir
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {showcase.map((catalogue) => {
                  const img = catalogue.pages[0]?.imagePath;
                  const imageUrl = img?.includes("uploads/") ? "/" + img.slice(img.indexOf("uploads/")) : img;
                  const state =
                    catalogue.startDate > now ? "upcoming"
                    : catalogue.endDate < now ? "expired" : "current";
                  return (
                    <Link
                      key={catalogue.id}
                      href={`/catalogue-marjane/${catalogue.slug}`}
                      className={`group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 ${state === "expired" ? "opacity-75" : ""}`}
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
                          {state === "current" && (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                              En cours
                            </span>
                          )}
                          {state === "upcoming" && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Bientôt
                            </span>
                          )}
                          {state === "expired" && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                              Expiré
                            </span>
                          )}
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
          );
        })()}

        {topDiscountOffers.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between gap-3 mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-lg p-2 shadow-lg shadow-red-200">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Meilleures promotions</h2>
              </div>
              <Link href="/promotions-marjane" className="shrink-0 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Tout voir
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topDiscountOffers.map((offer) => (
                <OfferCard key={offer.id} offer={JSON.parse(JSON.stringify(offer))} />
              ))}
            </div>
          </section>
        )}

        {topSavingsOffers.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between gap-3 mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-2 shadow-lg shadow-green-200">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Meilleures réductions</h2>
              </div>
              <Link href="/promotions-marjane" className="shrink-0 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Tout voir
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topSavingsOffers.map((offer) => (
                <OfferCard key={offer.id} offer={JSON.parse(JSON.stringify(offer))} />
              ))}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <section className="mb-16">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mb-6 sm:mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-2 shadow-lg shadow-orange-200 shrink-0">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Tendances de la semaine</h2>
                  <p className="text-sm text-gray-500">Les produits les plus consultés ces 7 derniers jours</p>
                </div>
              </div>
              <Link href="/produits" className="shrink-0 whitespace-nowrap self-start sm:self-auto text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Tous les produits
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 min-[560px]:grid-cols-2 md:grid-cols-4 gap-4">
              {trending.slice(0, 4).map(({ product, views }) => (
                <div key={product.id} className="relative">
                  {views >= 1000 && (
                    <span className="absolute -top-2 left-3 z-10 inline-flex items-center gap-1 bg-gray-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums">
                      <Eye className="h-3 w-3" />
                      {(views / 1000).toFixed(views >= 10000 ? 0 : 1).replace(".", ",")} k vues
                    </span>
                  )}
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </section>
        )}

        {trending.length === 0 && trendingFallback.length > 0 && (
          <section className="mb-16">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mb-6 sm:mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-2 shadow-lg shadow-orange-200 shrink-0">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Tendances de la semaine</h2>
                  <p className="text-sm text-gray-500">Les produits les plus suivis du moment</p>
                </div>
              </div>
              <Link href="/produits" className="shrink-0 whitespace-nowrap self-start sm:self-auto text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Tous les produits
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 min-[560px]:grid-cols-2 md:grid-cols-4 gap-4">
              {trendingFallback.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}


        <RecentlyViewedLoader />

        {activeDeals.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center justify-between gap-3 mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg p-2 shadow-lg shadow-purple-200">                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Bons plans</h2>
              </div>
              <Link href="/promotions-marjane" className="shrink-0 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                Toutes les promotions
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeDeals.map(({ deal, productCount }) => (
                <Link
                  key={deal.slug}
                  href={`/promotions-marjane/${deal.slug}`}
                  className="group bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-4xl font-extrabold tracking-tight">
                    {deal.slug === "50-pourcent-et-plus"
                      ? "-50% et plus"
                      : deal.slug === "moins-de-100-dh"
                        ? "Moins de 100 DH"
                        : "Top remises"}
                  </p>
                  <p className="font-semibold mt-2">{deal.title}</p>
                  <p className="text-sm text-gray-300 mt-1">
                    {deal.countLine(productCount)}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-bold text-orange-300 group-hover:text-orange-200">
                    Voir les offres
                    <svg className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-gray-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Catégories</h2>
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
            <div className="flex items-center justify-between gap-3 mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-orange-100 rounded-lg p-2">
                  <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6z" /></svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">Articles et conseils</h2>
              </div>
              <Link href="/articles" className="shrink-0 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
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
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                      {articleTypeLabel(article.articleType)}
                      {article.articleFocus ? ` — ${article.articleFocus}` : ""}
                    </span>
                    <span className="text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                      {article.primaryKeyword || "Conseil"}
                    </span>
                    {article.publishedAt && (
                      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
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
                    Lire l&apos;article
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