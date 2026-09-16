import Link from "next/link";
import { Suspense } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveDeals } from "@/lib/deals";
import OfferCard from "./offer-card";
import ProductSearch from "@/components/product-search";
import { getCategoryIcon } from "@/lib/category-icons";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const revalidate = 300;

export async function generateMetadata({ searchParams }: Props) {
  const { statut } = await searchParams;
  const isArchive = statut === "archive";
  if (isArchive) {
    return {
      title: "Archive promotions Marjane - Historique des offres expirées",
      description:
        "Historique des promotions Marjane expirées : prix indicatifs, non disponibles. Consultez les offres en cours pour les bons plans actuels.",
      robots: { index: false, follow: true },
      alternates: { canonical: "/promotions-marjane?statut=archive" },
    };
  }
  return metadata;
}

const metadata = {
  title: "Promotions Marjane - Offres et bons plans au Maroc",
  description:
    "Toutes les promotions Marjane en cours : électroménager, alimentation, high-tech, maison et plus encore au Maroc.",
  openGraph: {
    title: "Promotions Marjane - Offres et bons plans au Maroc",
    description: "Toutes les promotions Marjane en cours : électroménager, alimentation, high-tech, maison et plus encore au Maroc.",
    type: "website",
    url: "/promotions-marjane",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Promotions Marjane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Promotions Marjane - Offres et bons plans au Maroc",
    description: "Toutes les promotions Marjane en cours : électroménager, alimentation, high-tech, maison et plus encore au Maroc.",
    images: ["/api/og"],
  },
};

interface Props {
  searchParams: Promise<{ discount?: string; sort?: string; q?: string; statut?: string; categorie?: string }>;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default async function PromotionsPage({ searchParams }: Props) {
  const { discount, sort, q, statut, categorie } = await searchParams;
  const now = new Date();
  const query = (q || "").trim();
  const normalizedQuery = normalize(query);
  const isArchive = statut === "archive";

  const minDiscount = discount && discount !== "all" ? parseInt(discount) : 0;

  // Category acts as an in-page filter (?categorie=slug), not a navigation.
  const activeCategory = categorie
    ? await prisma.category.findUnique({ where: { slug: categorie }, select: { name: true, slug: true } })
    : null;

  // ACTIVE (en cours): startDate <= now AND endDate >= now
  // HISTORICAL (archive): endDate < now — prix indicatifs, non disponibles
  const dateFilter = isArchive ? { endDate: { lt: now } } : { startDate: { lte: now }, endDate: { gte: now } };

  const currentOffers = await prisma.offer.findMany({
    where: {
      ...dateFilter,
      catalogue: { status: "PUBLISHED" },
      ...(activeCategory ? { product: { category: activeCategory.name } } : {}),
      // In search mode, or when browsing an explicit category, the query /
      // category does the filtering — drop the discount gate so all of its
      // offers surface, even at small discounts.
      ...(query || activeCategory
        ? {}
        : minDiscount > 0
          ? { discountPercentage: { gte: minDiscount } }
          : { discountPercentage: { gt: 5 } }),
    },
    include: {
      product: true,
      catalogue: {
        include: {
          articles: {
            where: { status: "PUBLISHED" },
            select: { id: true, title: true, slug: true },
          },
        },
      },
      cataloguePage: {
        select: {
          imagePath: true,
          pageNumber: true,
          aiAnalysis: true,
        },
      },
    },
    orderBy:
      sort === "price-asc"
        ? { salePrice: "asc" }
        : sort === "price-desc"
          ? { salePrice: "desc" }
          : sort === "newest"
            ? { createdAt: "desc" }
            : { discountPercentage: "desc" },
    take: query ? 300 : 100,
  });

  const matchedOffers = query
    ? currentOffers.filter((o) => {
        const haystack = normalize(
          `${o.product.name} ${o.product.brand || ""} ${o.product.category}`
        );
        return normalizedQuery.split(/\s+/).every((word) => haystack.includes(word));
      })
    : currentOffers;

  const seen = new Set<string>();
  const uniqueOffers = matchedOffers
    .filter((o) => {
      if (seen.has(o.productId)) return false;
      seen.add(o.productId);
      return true;
    })
    .slice(0, 60);

  // Every category with ≥1 offer in the current mode (en cours / archive).
  // No discount gate here — categories with only small discounts stay visible;
  // empty ones (no offers at all) are excluded by the `some` clause.
  const categoryNamesWithOffers = await prisma.product.findMany({
    where: {
      offers: {
        some: {
          ...dateFilter,
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

  // Deal collections with enough live data — thin ones stay unlinked.
  const activeDeals = !isArchive ? await getActiveDeals() : [];

  // Preserve every other filter when toggling one (server-rendered links, no JS).
  function filterHref(overrides: { discount?: string | null; sort?: string | null; categorie?: string | null }): string {
    const params = new URLSearchParams();
    const d = overrides.discount !== undefined ? overrides.discount : discount;
    const s = overrides.sort !== undefined ? overrides.sort : sort;
    const c = overrides.categorie !== undefined ? overrides.categorie : categorie;
    if (d && d !== "all") params.set("discount", d);
    if (s && s !== "discount-desc") params.set("sort", s);
    if (query) params.set("q", query);
    if (isArchive) params.set("statut", "archive");
    if (c) params.set("categorie", c);
    const str = params.toString();
    return str ? `/promotions-marjane?${str}` : "/promotions-marjane";
  }

  const DISCOUNT_OPTIONS = [
    { label: "Tous", value: null },
    { label: "10%+", value: "10" },
    { label: "20%+", value: "20" },
    { label: "30%+", value: "30" },
    { label: "40%+", value: "40" },
    { label: "50%+", value: "50" },
  ] as const;

  const SORT_OPTIONS = [
    { label: "Meilleure réduction", value: null },
    { label: "Prix croissant", value: "price-asc" },
    { label: "Prix décroissant", value: "price-desc" },
    { label: "Nouveautés", value: "newest" },
  ] as const;

  const currentDiscount = discount ?? "all";
  const currentSort = sort ?? "discount-desc";
  const hasFilters =
    !!activeCategory || currentDiscount !== "all" || currentSort !== "discount-desc" || !!query;
  const resetHref = isArchive ? "/promotions-marjane?statut=archive" : "/promotions-marjane";

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Promotions", url: "/promotions-marjane" },
        ]}
      />
      <header className="relative bg-gradient-to-br from-orange-500 via-red-500 to-red-600 text-white overflow-hidden">
        {/* decorative shapes fill the void on wide screens */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-40 -bottom-32 h-72 w-72 rounded-full bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-10">
          <nav className="text-sm text-white/70 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-white font-medium">Promotions</span>
          </nav>
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="mt-1 shrink-0 bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    {query ? (
                      <>Résultats pour «&nbsp;{query}&nbsp;»</>
                    ) : isArchive ? (
                      "Archive promotions Marjane"
                    ) : (
                      "Promotions Marjane"
                    )}
                  </h1>
                  <p className="text-orange-100 mt-1">
                    {uniqueOffers.length} offre{uniqueOffers.length !== 1 ? "s" : ""}{query ? "" : isArchive ? " expirées — prix indicatifs" : " en cours"}
                  </p>
                </div>
              </div>
              <div className="mt-4 inline-flex bg-white/15 backdrop-blur-sm rounded-full p-1 text-sm font-medium">
                <Link
                  href="/promotions-marjane"
                  className={`px-4 py-1.5 rounded-full transition-colors ${!isArchive ? "bg-white text-red-600 shadow" : "text-white hover:text-white/80"}`}
                >
                  En cours
                </Link>
                <Link
                  href="/promotions-marjane?statut=archive"
                  className={`px-4 py-1.5 rounded-full transition-colors ${isArchive ? "bg-white text-red-600 shadow" : "text-white hover:text-white/80"}`}
                >
                  Archive
                </Link>
              </div>
            </div>
            <div className="hidden lg:block shrink-0">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-6 text-center">
                <p className="text-5xl font-extrabold tracking-tight">{uniqueOffers.length}</p>
                <p className="text-orange-100 text-sm mt-1">
                  {query ? "résultats" : isArchive ? "offres expirées" : "offres en cours"}
                </p>
                <p className="text-white/60 text-xs mt-2 max-w-[180px]">
                  {isArchive
                    ? "Prix indicatifs, non disponibles en magasin"
                    : "Mis à jour à chaque catalogue"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {isArchive && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            Historique des offres expirées — prix indicatifs, non disponibles en magasin.
            Pour les bons plans actuels, voir les{" "}
            <Link href="/promotions-marjane" className="font-semibold underline hover:text-amber-900">
              offres en cours
            </Link>
            .
          </div>
        )}
        {activeDeals.length > 0 && (
          <section className="mb-8">
            <div className="flex flex-wrap gap-2">
              {activeDeals.map(({ deal, productCount }) => (
                <Link
                  key={deal.slug}
                  href={`/promotions-marjane/${deal.slug}`}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-full pl-4 pr-3 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  {deal.label}
                  <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                    {productCount}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* Unified search + filters: one card instead of three stacked blocks */}
        <section className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-8">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <SlidersHorizontal className="h-4 w-4 text-gray-500" />
              Recherche & filtres
            </h2>
            {hasFilters && (
              <Link
                href={resetHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
                Réinitialiser
              </Link>
            )}
          </div>

          <Suspense>
            <ProductSearch defaultValue={query} preserveFilters />
          </Suspense>

          {categories.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500 mt-4 mb-2">Catégorie</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <Link
                  href={filterHref({ categorie: null })}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center border rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    !activeCategory
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  Toutes
                </Link>
                {categories.map((cat) => {
                  const Icon = getCategoryIcon(cat.name);
                  const isActive = activeCategory?.slug === cat.slug;
                  return (
                    <Link
                      key={cat.id}
                      href={filterHref({ categorie: isActive ? null : cat.slug })}
                      aria-pressed={isActive}
                      className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 border rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-red-500 text-white border-red-500 shadow-sm"
                          : "bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {cat.name}
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Réduction</p>
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_OPTIONS.map((opt) => {
                  const isActive = currentDiscount === (opt.value ?? "all");
                  return (
                    <Link
                      key={opt.label}
                      href={filterHref({ discount: opt.value })}
                      aria-pressed={isActive}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-red-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Trier par</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => {
                  const isActive = currentSort === (opt.value ?? "discount-desc");
                  return (
                    <Link
                      key={opt.label}
                      href={filterHref({ sort: opt.value })}
                      aria-pressed={isActive}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-gray-800 text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-lg p-2 shadow-lg shadow-red-200">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{isArchive ? "Offres expirées" : "Toutes les offres"}</h2>
          </div>
          {uniqueOffers.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>
              </div>
              <p className="text-gray-500 text-lg">Aucune offre ne correspond à vos critères.</p>
              <Link href={isArchive ? "/promotions-marjane?statut=archive" : "/promotions-marjane"} className="text-red-500 hover:text-red-600 text-sm mt-2 inline-block">
                Réinitialiser les filtres
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={JSON.parse(JSON.stringify(offer))}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
