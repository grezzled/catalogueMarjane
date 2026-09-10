import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalogues Marjane - Tous les catalogues",
  description:
    "Tous les catalogues Marjane : catalogues en cours, archive et prochaines promotions au Maroc.",
};

export default async function CataloguesListPage() {
  const catalogues = await prisma.catalogue.findMany({
    where: { status: { in: ["PUBLISHED", "REVIEW"] } },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      startDate: true,
      endDate: true,
      pageCount: true,
      offerCount: true,
      productCount: true,
      pages: {
        where: { pageNumber: 1 },
        select: { imagePath: true },
        take: 1,
      },
    },
  });

  const now = new Date();
  const current = catalogues.filter(
    (c) => c.startDate <= now && c.endDate >= now
  );
  const upcoming = catalogues.filter((c) => c.startDate > now);
  const expired = catalogues.filter((c) => c.endDate < now);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-2">Tous les Catalogues Marjane</h1>
          <p className="text-gray-300">
            Retrouvez tous les catalogues Marjane passés et en cours
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {current.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Catalogues en cours
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {current.map((c) => (
                <CatalogueCard key={c.id} catalogue={c} />
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              Prochains catalogues
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((c) => (
                <CatalogueCard key={c.id} catalogue={c} />
              ))}
            </div>
          </section>
        )}

        {expired.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              Archive
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {expired.map((c) => (
                <CatalogueCard key={c.id} catalogue={c} expired />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function CatalogueCard({
  catalogue,
  expired = false,
}: {
  catalogue: {
    id: string;
    title: string;
    slug: string;
    startDate: Date;
    endDate: Date;
    pageCount: number;
    offerCount: number;
    productCount: number;
    pages: { imagePath: string | null }[];
  };
  expired?: boolean;
}) {
  const imagePath = catalogue.pages[0]?.imagePath;
  const imageUrl = imagePath?.includes("uploads/")
    ? "/" + imagePath.slice(imagePath.indexOf("uploads/"))
    : imagePath;

  return (
    <Link
      href={`/catalogue-marjane/${catalogue.slug}`}
      className={`block border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${
        expired ? "opacity-75" : ""
      }`}
    >
      {imageUrl && (
        <div className="bg-gray-100">
          <img
            src={imageUrl}
            alt={catalogue.title}
            className="w-full h-48 object-cover"
          />
        </div>
      )}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {catalogue.title}
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {formatDateRange(catalogue.startDate, catalogue.endDate)}
        </p>
        <div className="flex gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            {catalogue.pageCount} pages
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
            {catalogue.offerCount} offres
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
            {catalogue.productCount} produits
          </span>
        </div>
        {expired && (
          <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
            Archivé
          </span>
        )}
      </div>
    </Link>
  );
}
