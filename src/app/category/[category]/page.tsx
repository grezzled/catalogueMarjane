import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import OfferCard from "@/app/promotions-marjane/offer-card";
import CategoryFilters from "@/components/category-filters";
import { getCategoryIcon } from "@/lib/category-icons";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    select: { slug: true },
  });
  return categories.map((c) => ({ category: c.slug }));
}

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ discount?: string; sort?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await prisma.category.findUnique({ where: { slug: category } });
  if (!cat) return { title: "Catégorie non trouvée" };

  return {
    title: `${cat.name} - Toutes les offres Marjane`,
    description: `Découvrez tous les produits et offres Marjane dans la catégorie ${cat.name}.`,
    alternates: { canonical: `/category/${category}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const { discount, sort } = await searchParams;
  const cat = await prisma.category.findUnique({ where: { slug: category } });
  if (!cat) notFound();

  const now = new Date();

  const minDiscount = discount && discount !== "all" ? parseInt(discount) : 0;

  const offers = await prisma.offer.findMany({
    where: {
      product: { category: cat.name },
      startDate: { lte: now },
      endDate: { gte: now },
      ...(minDiscount > 0 ? { discountPercentage: { gte: minDiscount } } : {}),
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
        select: { imagePath: true, pageNumber: true, aiAnalysis: true },
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
  });

  const seen = new Set<string>();
  const uniqueOffers = offers.filter((o) => {
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
        },
      },
    },
    distinct: ["category"],
    select: { category: true },
  });

  const validCategoryNames = categoryNamesWithOffers.map((p) => p.category);

  const allCategories = await prisma.category.findMany({
    where: {
      name: { in: validCategoryNames },
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <nav className="text-sm text-gray-400 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/catalogue-marjane" className="hover:text-white transition-colors">Catalogues</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white font-medium">{cat.name}</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5">
              {(() => {
                const Icon = getCategoryIcon(cat.name);
                return <Icon className="h-7 w-7" />;
              })()}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{cat.name}</h1>
              <p className="text-gray-400 mt-1">
                {uniqueOffers.length} produit{uniqueOffers.length !== 1 ? "s" : ""} en promotion
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <CategoryFilters />

        {uniqueOffers.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              {(() => {
                const Icon = getCategoryIcon(cat.name);
                return <Icon className="h-8 w-8 text-gray-400" />;
              })()}
            </div>
            <p className="text-gray-500 text-lg">Aucune offre ne correspond à vos critères.</p>
            <Link href={`/category/${category}`} className="text-red-500 hover:text-red-600 text-sm mt-2 inline-block">
              Voir toutes les offres
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueOffers.map((offer) => (
              <OfferCard key={offer.id} offer={JSON.parse(JSON.stringify(offer))} />
            ))}
          </div>
        )}

        {allCategories.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Toutes les catégories</h2>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((rc) => {
                const Icon = getCategoryIcon(rc.name);
                const isCurrent = rc.id === cat.id;
                return (
                  <Link
                    key={rc.slug}
                    href={`/category/${rc.slug}`}
                    className={`inline-flex items-center gap-1.5 border rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      isCurrent
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {rc.name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
