import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";
import CountdownTimer from "@/components/countdown-timer";
import CatalogueProductSection from "@/components/catalogue-products";
import CatalogueSidebar from "@/components/catalogue-sidebar";
import TopOffersSection from "@/components/top-offers-section";
import { FileText, Package, Tag, Calendar, Clock, AlertCircle, CheckCircle2, ChevronRight, BookOpen } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  const catalogues = await prisma.catalogue.findMany({
    select: { slug: true },
  });
  return catalogues.map((c) => ({ slug: c.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const catalogue = await prisma.catalogue.findUnique({
    where: { slug },
  });

  if (!catalogue) return { title: "Catalogue non trouvé" };

  return {
    title: `Catalogue Marjane ${formatDateRange(catalogue.startDate, catalogue.endDate)} : promotions`,
    description: `Découvrez le catalogue Marjane du ${formatDateRange(catalogue.startDate, catalogue.endDate)} : électroménager, alimentation, maison, high-tech et toutes les promotions du moment.`,
    alternates: {
      canonical: `/catalogue-marjane/${catalogue.slug}`,
    },
    openGraph: {
      title: `Catalogue Marjane ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
      description: `Promotions et offres Marjane du ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
      type: "website",
      url: `/catalogue-marjane/${catalogue.slug}`,
      siteName: "Catalogue Marjane",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `Catalogue Marjane ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Catalogue Marjane ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
      description: `Promotions et offres Marjane du ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
      images: ["/opengraph-image"],
    },
  };
}

export default async function CatalogueDetailPage({ params }: Props) {
  const { slug } = await params;
  const catalogue = await prisma.catalogue.findUnique({
    where: { slug },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
        select: {
          id: true,
          pageNumber: true,
          pageType: true,
          category: true,
          productCount: true,
          aiAnalysis: true,
          imagePath: true,
        },
      },
      offers: {
        include: {
          product: true,
          cataloguePage: {
            select: { pageNumber: true, imagePath: true },
          },
        },
        orderBy: { discountPercentage: "desc" },
      },
    },
  });

  if (!catalogue) notFound();

  const now = new Date();

  const actualProductCount = new Set(catalogue.offers.map((o) => o.productId)).size;
  const actualOfferCount = catalogue.offers.length;

  const categoryNames = [...new Set(catalogue.pages.map((p) => p.category).filter((c): c is string => !!c && c !== "Other"))];

  const [relatedArticles, allCategories] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        articleCategories: {
          some: {
            category: {
              name: { in: categoryNames },
            },
          },
        },
      },
      take: 5,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        primaryKeyword: true,
        publishedAt: true,
      },
    }),
    prisma.category.findMany({
      where: {
        name: { in: categoryNames },
      },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const topOffers = catalogue.offers.filter(
    (o) => o.discountPercentage && o.discountPercentage > 10
  );

  const isExpired = catalogue.endDate < now;
  const isCurrent = catalogue.startDate <= now && catalogue.endDate >= now;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Catalogue Marjane ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
    description: `Promotions et offres du catalogue Marjane du ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
    url: `/catalogue-marjane/${catalogue.slug}`,
    datePublished: catalogue.startDate.toISOString(),
    dateModified: catalogue.updatedAt.toISOString(),
  };

  function toImageUrl(imagePath: string | null): string | null {
    if (!imagePath) return null;
    const uploadsIdx = imagePath.indexOf("uploads/");
    if (uploadsIdx !== -1) {
      return "/" + imagePath.slice(uploadsIdx);
    }
    return imagePath;
  }

  function StatCard({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
    return (
      <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2 text-blue-100">{icon}</div>
        <p className="text-2xl font-extrabold tabular-nums">{value.toLocaleString()}</p>
        <p className="text-blue-200 text-xs font-medium">{label}</p>
      </div>
    );
  }

  const PageIcon = () => <FileText className="h-5 w-5" />;
  const ProductIcon = () => <Package className="h-5 w-5" />;
  const OfferIcon = () => <Tag className="h-5 w-5" />;

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="bg-gradient-to-br from-blue-600 via-blue-600 to-blue-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
          <nav className="text-xs sm:text-sm text-blue-200/80 mb-4 sm:mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/catalogue-marjane" className="hover:text-white transition-colors">Catalogues</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white font-medium truncate">{catalogue.title}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{catalogue.title}</h1>
              <p className="text-blue-100 text-sm sm:text-lg flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                {formatDateRange(catalogue.startDate, catalogue.endDate)}
              </p>
            </div>
            {isCurrent && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 sm:px-4 sm:py-2 shrink-0">
                <CountdownTimer endDate={catalogue.endDate.toISOString()} />
              </div>
            )}
            {isExpired && (
              <span className="bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl shrink-0">Expiré</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard value={catalogue.pageCount} label="Pages" icon={<PageIcon />} />
            <StatCard value={actualProductCount} label="Produits" icon={<ProductIcon />} />
            <StatCard value={actualOfferCount} label="Offres" icon={<OfferIcon />} />
          </div>
          <Link 
            href={`/catalogue-marjane/${catalogue.slug}/page/1`}
            className="mt-5 sm:mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-blue-600 font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Parcourir le catalogue
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">
            <TopOffersSection topOffers={topOffers} catalogueSlug={catalogue.slug} catalogueTitle={catalogue.title} />

        <section className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gray-100 rounded-lg p-2">
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Pages du catalogue</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {catalogue.pages.map((page) => (
              <Link
                key={page.id}
                href={`/catalogue-marjane/${catalogue.slug}/page/${page.pageNumber}`}
                className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all"
              >
                {page.imagePath && toImageUrl(page.imagePath) ? (
                  <div className="relative">
                    <img
                      src={toImageUrl(page.imagePath)!}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-32 object-cover"
                    />
                    <span className="absolute top-2 left-2 bg-white/90 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full shadow">
                      {page.pageNumber}
                    </span>
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-gray-100 group-hover:bg-blue-50 rounded-full flex items-center justify-center mx-auto mt-4 mb-2 transition-colors">
                    <span className="font-bold text-gray-600 group-hover:text-blue-600 text-sm transition-colors">{page.pageNumber}</span>
                  </div>
                )}
                <div className="p-3 text-center">
                  {page.category && (
                    <p className="text-xs text-gray-500 mb-1">{page.category}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {page.productCount} produits
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <CatalogueProductSection
          offers={JSON.parse(JSON.stringify(catalogue.offers))}
          catalogueSlug={catalogue.slug}
          catalogueTitle={catalogue.title}
        />

        <section className="bg-white border border-gray-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-100 rounded-lg p-2">
              <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">À propos de ce catalogue</h2>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Ce catalogue Marjane est valable du{" "}
            <span className="font-medium text-gray-700">{formatDateRange(catalogue.startDate, catalogue.endDate)}</span>.
            Il contient <span className="font-medium text-gray-700">{catalogue.pageCount} pages</span> avec{" "}
            <span className="font-medium text-gray-700">{actualOfferCount} offres</span> sur{" "}
            <span className="font-medium text-gray-700">{actualProductCount} produits</span> différents.
          </p>
          {catalogue.sourceUrl && (
            <a
              href={catalogue.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              Voir le catalogue original
            </a>
          )}
        </section>
          </div>

          <div className="w-full lg:w-80 shrink-0">
            <CatalogueSidebar
              articles={JSON.parse(JSON.stringify(relatedArticles))}
              categories={JSON.parse(JSON.stringify(allCategories))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}