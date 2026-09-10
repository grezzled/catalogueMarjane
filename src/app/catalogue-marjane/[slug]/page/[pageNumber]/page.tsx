import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const uploadsIdx = imagePath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    return "/" + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

interface Props {
  params: Promise<{ slug: string; pageNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pageNumber } = await params;
  const page = await prisma.cataloguePage.findFirst({
    where: {
      catalogue: { slug },
      pageNumber: parseInt(pageNumber),
    },
    include: {
      catalogue: true,
      offers: { include: { product: true } },
    },
  });

  if (!page) return { title: "Page non trouvée" };

  const productNames = page.offers.slice(0, 3).map((o) => o.product.name).join(", ");
  const title = `Page ${page.pageNumber} - ${page.catalogue.title} | Catalogue Marjane`;
  const description = productNames
    ? `Offres sur la page ${page.pageNumber} : ${productNames}`
    : `Consultez la page ${page.pageNumber} du catalogue Marjane ${formatDateRange(page.catalogue.startDate, page.catalogue.endDate)}`;

  return {
    title,
    description,
    alternates: { canonical: `/catalogue-marjane/${slug}/page/${pageNumber}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function CataloguePageDetail({ params }: Props) {
  const { slug, pageNumber } = await params;
  const pageNum = parseInt(pageNumber);

  if (isNaN(pageNum)) notFound();

  const page = await prisma.cataloguePage.findFirst({
    where: {
      catalogue: { slug },
      pageNumber: pageNum,
    },
    include: {
      catalogue: true,
      offers: {
        include: { product: true },
        orderBy: { discountPercentage: "desc" },
      },
    },
  });

  if (!page) notFound();

  const totalPages = await prisma.cataloguePage.count({
    where: { catalogueId: page.catalogueId },
  });

  const prevPage = pageNum > 1 ? pageNum - 1 : null;
  const nextPage = pageNum < totalPages ? pageNum + 1 : null;

  const imageUrl = toImageUrl(page.imagePath);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Page ${pageNum} - ${page.catalogue.title}`,
    description: `Offres et promotions catalogue Marjane page ${pageNum}`,
    url: `/catalogue-marjane/${slug}/page/${pageNum}`,
    image: imageUrl,
    isPartOf: {
      "@type": "Book",
      name: page.catalogue.title,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <nav className="text-sm text-gray-400 mb-4 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <Link href="/catalogue-marjane" className="hover:text-white transition-colors">Catalogues</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <Link href={`/catalogue-marjane/${slug}`} className="hover:text-white transition-colors">{page.catalogue.title}</Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            <span className="text-white font-medium">Page {pageNum}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Page {pageNum}
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {page.catalogue.title} — {formatDateRange(page.catalogue.startDate, page.catalogue.endDate)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {prevPage && (
                <Link
                  href={`/catalogue-marjane/${slug}/page/${prevPage}`}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </Link>
              )}
              <span className="bg-white/10 text-white text-sm font-bold px-3 py-1.5 rounded-lg">
                {pageNum} / {totalPages}
              </span>
              {nextPage && (
                <Link
                  href={`/catalogue-marjane/${slug}/page/${nextPage}`}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="lg:sticky lg:top-8 lg:self-start">
            {imageUrl && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                <img
                  src={imageUrl}
                  alt={`Page ${pageNum} du catalogue Marjane ${page.catalogue.title}`}
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>

          <div>
            {page.offers.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-lg p-2 shadow-lg shadow-red-200">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {page.offers.length} offre{page.offers.length > 1 ? "s" : ""}
                    </h2>
                    <p className="text-sm text-gray-500">sur cette page</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {page.offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          {offer.product.category}
                        </span>
                        {offer.discountPercentage && (
                          <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-extrabold px-2 py-0.5 rounded-full">
                            -{Math.round(offer.discountPercentage)}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 leading-snug">
                        {offer.product.name}
                      </h3>
                      {offer.product.brand && (
                        <p className="text-sm text-gray-500 mt-0.5">{offer.product.brand}</p>
                      )}
                      <div className="mt-2 flex items-end gap-2">
                        {offer.originalPrice && (
                          <span className="text-gray-400 line-through text-sm">
                            {offer.originalPrice.toLocaleString()} DH
                          </span>
                        )}
                        {offer.salePrice && (
                          <span className="text-red-600 font-extrabold text-xl">
                            {offer.salePrice.toLocaleString()} <span className="text-sm">DH</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>
                </div>
                <p className="text-gray-500 text-lg">Aucune offre extraite de cette page.</p>
              </div>
            )}

            <div className="mt-10 flex items-center justify-between">
              {prevPage ? (
                <Link
                  href={`/catalogue-marjane/${slug}/page/${prevPage}`}
                  className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm font-medium text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                  Page {prevPage}
                </Link>
              ) : (
                <div />
              )}
              {nextPage ? (
                <Link
                  href={`/catalogue-marjane/${slug}/page/${nextPage}`}
                  className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-5 py-3 text-sm font-medium text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all"
                >
                  Page {nextPage}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}