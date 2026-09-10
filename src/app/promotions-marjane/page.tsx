import Link from "next/link";
import { prisma } from "@/lib/prisma";
import OfferCard from "./offer-card";
import CategoryFilters from "@/components/category-filters";
import { getCategoryIcon } from "@/lib/category-icons";

export const revalidate = 3600;

export const metadata = {
  title: "Promotions Marjane - Offres et bons plans au Maroc",
  description:
    "Toutes les promotions Marjane en cours : électroménager, alimentation, high-tech, maison et plus encore au Maroc.",
};

interface Props {
  searchParams: Promise<{ discount?: string; sort?: string }>;
}

export default async function PromotionsPage({ searchParams }: Props) {
  const { discount, sort } = await searchParams;
  const now = new Date();

  const minDiscount = discount && discount !== "all" ? parseInt(discount) : 0;

  const currentOffers = await prisma.offer.findMany({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      ...(minDiscount > 0 ? { discountPercentage: { gte: minDiscount } } : { discountPercentage: { gt: 5 } }),
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
    take: 100,
  });

  const seen = new Set<string>();
  const uniqueOffers = currentOffers.filter((o) => {
    if (seen.has(o.productId)) return false;
    seen.add(o.productId);
    return true;
  });

  const categoryNamesWithOffers = await prisma.product.findMany({
    where: {
      offers: {
        some: {
          startDate: { lte: now },
          endDate: { gte: now },
          discountPercentage: { gt: 5 },
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
      <header className="bg-gradient-to-br from-orange-500 via-red-500 to-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <nav className="text-sm text-white/70 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-white font-medium">Promotions</span>
          </nav>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">Promotions Marjane</h1>
              <p className="text-orange-100 mt-1">
                {uniqueOffers.length} offre{uniqueOffers.length !== 1 ? "s" : ""} en cours
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {categories.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gray-100 rounded-lg p-2">
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Catégories</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const Icon = getCategoryIcon(cat.name);
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    <Icon className="h-4 w-4" />
                    {cat.name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <CategoryFilters />

        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-lg p-2 shadow-lg shadow-red-200">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Toutes les offres</h2>
          </div>
          {uniqueOffers.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>
              </div>
              <p className="text-gray-500 text-lg">Aucune offre ne correspond à vos critères.</p>
              <Link href="/promotions-marjane" className="text-red-500 hover:text-red-600 text-sm mt-2 inline-block">
                Voir toutes les offres
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
