import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";
import CountdownTimer from "@/components/countdown-timer";
import CatalogueSidebar from "@/components/catalogue-sidebar";
import CataloguePageExplorer from "@/components/catalogue-page-explorer";
import CatalogueOffersTable from "@/components/catalogue-offers-table";
import CommentsSection from "@/components/comments-section";
import { CommentCta } from "@/components/comments-section";
import TopOffersSection from "@/components/top-offers-section";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { ChevronRight, FileText, Tag, LayoutGrid } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 600;

export async function generateStaticParams() {
  const catalogues = await prisma.catalogue.findMany({
    where: { status: "PUBLISHED" },
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
    include: {
      offers: { select: { id: true, discountPercentage: true, product: { select: { category: true } } } },
    },
  });

  if (!catalogue || catalogue.status !== "PUBLISHED") return { title: "Catalogue non trouvé" };

  const dates = formatDateRange(catalogue.startDate, catalogue.endDate);
  const offerCount = catalogue.offers.length;
  const maxDiscount = catalogue.offers.reduce(
    (max, o) => Math.max(max, o.discountPercentage ?? 0),
    0
  );
  const topRayons = [...new Set(catalogue.offers.map((o) => o.product.category).filter(Boolean))].slice(0, 3);
  const rayons = topRayons.length > 0 ? ` Rayons : ${topRayons.join(", ")}.` : "";

  const desc = catalogue.description
    ? catalogue.description.split(/\n\s*\n/)[0].slice(0, 155)
    : maxDiscount > 0
      ? `Catalogue Marjane du ${dates}. ${offerCount} offres avec réductions jusqu'à ${maxDiscount}%.${rayons}`
      : `Catalogue Marjane du ${dates}. ${offerCount} produits et promotions sur l'électroménager, l'alimentation, la maison et le high-tech.${rayons}`;

  return {
    title: `Catalogue Marjane ${dates} - Promotions et Offres`,
    description: desc,
    alternates: {
      canonical: `/catalogue-marjane/${catalogue.slug}`,
    },
    openGraph: {
      title: `Catalogue Marjane ${dates}`,
      description: desc,
      type: "website",
      url: `/catalogue-marjane/${catalogue.slug}`,
      siteName: "Catalogue Marjane",
      images: [
        {
          url: `/api/og?type=catalogue&slug=${catalogue.slug}`,
          width: 1200,
          height: 630,
          alt: `Catalogue Marjane ${dates}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Catalogue Marjane ${dates}`,
      description: desc,
      images: [`/api/og?type=catalogue&slug=${catalogue.slug}`],
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

  if (!catalogue || catalogue.status !== "PUBLISHED") notFound();

  const now = new Date();

  const actualProductCount = new Set(catalogue.offers.map((o) => o.productId)).size;
  const actualOfferCount = catalogue.offers.length;

  const categoryNames = [...new Set(catalogue.pages.map((p) => p.category).filter((c): c is string => !!c && c !== "Other"))];

  // Shoppable hotspots: match AI bounding boxes (normalized 0-1 coords in
  // page aiAnalysis) to this catalogue's offers by normalized product name.
  // Analysis names may carry Arabic suffixes ("… سمك") or extra punctuation
  // while DB names are French-only, so compare on stripped latin cores.
  function normName(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const offerIdByNormName = new Map<string, string>();
  for (const o of catalogue.offers) {
    const key = normName(o.product.name);
    if (key && !offerIdByNormName.has(key)) offerIdByNormName.set(key, o.productId);
  }
  interface Hotspot {
    pageNumber: number;
    x: number;
    y: number;
    w: number;
    h: number;
    productId: string;
  }
  const hotspots: Hotspot[] = catalogue.pages.flatMap((p) => {
    if (!p.aiAnalysis) return [];
    try {
      const analysis = JSON.parse(p.aiAnalysis) as {
        products?: { name?: unknown; boundingBox?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | null }[];
      };
      if (!Array.isArray(analysis.products)) return [];
      return analysis.products.flatMap((ap): Hotspot[] => {
        if (typeof ap?.name !== "string") return [];
        const box = ap.boundingBox;
        if (!box) return [];
        const { x, y, width, height } = box;
        if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") return [];
        const productId = offerIdByNormName.get(normName(ap.name));
        if (!productId) return [];
        return [{ pageNumber: p.pageNumber, x, y, w: width, h: height, productId }];
      });
    } catch {
      return [];
    }
  });

  // Strict: only articles generated from THIS catalogue.
  // The sidebar hides itself when the list is empty.
  const [relatedArticles, allCategories] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", catalogueId: catalogue.id },
      take: 5,
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

  // Unique per-catalogue numbers-as-text: category breakdown for SEO + UX.
  const categoryStats = (() => {
    const map = new Map<string, { offers: number; maxDiscount: number; minPrice: number | null; topProduct: string }>();
    for (const o of catalogue.offers) {
      const name = o.product.category?.trim() || "Autres";
      const entry = map.get(name) ?? { offers: 0, maxDiscount: 0, minPrice: null as number | null, topProduct: "" };
      entry.offers += 1;
      if ((o.discountPercentage ?? 0) > entry.maxDiscount) {
        entry.maxDiscount = o.discountPercentage ?? 0;
        entry.topProduct = o.product.name;
      }
      if (o.salePrice != null && (entry.minPrice == null || o.salePrice < entry.minPrice)) {
        entry.minPrice = o.salePrice;
      }
      map.set(name, entry);
    }
    return [...map.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.offers - a.offers);
  })();

  const maxDiscountAll = categoryStats.reduce((m, c) => Math.max(m, c.maxDiscount), 0);
  const topDeals = catalogue.offers
    .filter((o) => (o.discountPercentage ?? 0) > 0)
    .slice(0, 3);
  const datesStr = formatDateRange(catalogue.startDate, catalogue.endDate);
  const daysLeft = Math.max(0, Math.ceil((catalogue.endDate.getTime() - now.getTime()) / 86400000));

  const faqItems = [
    {
      q: `Quand est valable le catalogue « ${catalogue.title} » ?`,
      a: `Du ${datesStr}.` + (isExpired
        ? " Ce catalogue est terminé : les prix affichés sont indicatifs."
        : ` Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} pour en profiter.`),
    },
    {
      q: "Combien d'offres contient ce catalogue Marjane ?",
      a: `${actualOfferCount} offres sur ${actualProductCount} produits différents, réparties sur ${catalogue.pageCount} pages.`,
    },
    ...(topDeals.length > 0
      ? [{
          q: "Quelles sont les plus grosses promotions du catalogue ?",
          a: topDeals.map((o) => `${o.product.name} (-${Math.round(o.discountPercentage ?? 0)}%)`).join(", ") + ".",
        }]
      : []),
    ...(categoryStats.length > 0
      ? [{
          q: "Quels rayons sont concernés par ces promotions ?",
          a: categoryStats.slice(0, 5).map((c) => `${c.name} (${c.offers} offre${c.offers > 1 ? "s" : ""})`).join(", ") + ".",
        }]
      : []),
    {
      q: "Où ces prix sont-ils valables ?",
      a: "Dans les magasins Marjane au Maroc, pendant la période de validité. En cas de différence, le catalogue officiel fait foi.",
    },
  ];

  const topOffersForJsonLd = topOffers.slice(0, 10).map((offer, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Product",
      name: offer.product.name,
      image: offer.product.imageUrl || undefined,
      offers: {
        "@type": "Offer",
        price: offer.salePrice?.toString() || "",
        priceCurrency: "MAD",
        availability: "https://schema.org/InStock",
      },
    },
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `Catalogue Marjane ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
        description: `Promotions et offres du catalogue Marjane du ${formatDateRange(catalogue.startDate, catalogue.endDate)}`,
        url: `/catalogue-marjane/${catalogue.slug}`,
        datePublished: catalogue.startDate.toISOString(),
        dateModified: catalogue.updatedAt.toISOString(),
        publisher: {
          "@type": "Organization",
          name: "Catalogue Marjane",
          url: process.env.NEXT_PUBLIC_APP_URL || "https://cataloguemarjane.com",
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: actualOfferCount,
          itemListElement: topOffersForJsonLd,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  function toImageUrl(imagePath: string | null): string | null {
    if (!imagePath) return null;
    const uploadsIdx = imagePath.indexOf("uploads/");
    if (uploadsIdx !== -1) {
      return "/" + imagePath.slice(uploadsIdx);
    }
    return imagePath;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Catalogues", url: "/catalogue-marjane" },
          { name: catalogue.title, url: `/catalogue-marjane/${catalogue.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="bg-gradient-to-br from-blue-600 via-blue-600 to-blue-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <nav className="text-xs text-blue-200/80 mb-2 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/catalogue-marjane" className="hover:text-white transition-colors">Catalogues</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white font-medium truncate">{catalogue.title}</span>
          </nav>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight line-clamp-2">{catalogue.title}</h1>
                {isExpired && (
                  <span className="bg-amber-400 text-amber-950 text-xs font-bold px-2.5 py-1 rounded-full shrink-0">Expiré</span>
                )}
              </div>
              <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                {formatDateRange(catalogue.startDate, catalogue.endDate)}
              </p>
            </div>
            <div className="shrink-0 flex sm:flex-col sm:items-end gap-1.5 sm:ml-auto">
              {isCurrent && (
                <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
                  <CountdownTimer endDate={catalogue.endDate.toISOString()} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-5 sm:gap-y-2 text-blue-100 text-xs sm:text-base font-medium">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <FileText className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  {catalogue.pageCount} pages
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Tag className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  {actualOfferCount} offres
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <LayoutGrid className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  {allCategories.length} catégories
                </span>
                <CommentCta compact target="catalogue" targetId={catalogue.id} prompt="Avez-vous profité de ce catalogue ?" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 [&>section]:mb-0">
          {/* Explorer gets the full width — catalogue page takes maximum space */}
          <CataloguePageExplorer
            title={catalogue.title}
            catalogueSlug={catalogue.slug}
            pages={catalogue.pages.map((p) => ({
              pageNumber: p.pageNumber,
              imageUrl: toImageUrl(p.imagePath),
              category: p.category,
            }))}
            offers={JSON.parse(JSON.stringify(catalogue.offers))}
            hotspots={hotspots}
          />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8 items-stretch lg:items-start">
        <main className="flex-1 min-w-0 w-full overflow-x-clip">
          <TopOffersSection topOffers={topOffers} catalogueSlug={catalogue.slug} catalogueTitle={catalogue.title} />

        <CatalogueOffersTable
          offers={JSON.parse(JSON.stringify(catalogue.offers))}
          catalogueSlug={catalogue.slug}
          catalogueTitle={catalogue.title}
        />

        {/* Unique editorial content: data-driven intro + category breakdown */}
        <section className="mb-14" aria-label="Ce catalogue en bref">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl p-2.5 shadow-lg shadow-emerald-200">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ce catalogue en bref</h2>
              <p className="text-sm text-gray-500">Rayons, offres et réductions en un coup d&apos;œil</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
            {catalogue.description ? (
              catalogue.description.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="text-gray-700 leading-relaxed mt-4 first:mt-0">
                  {para}
                </p>
              ))
            ) : (
              <p className="text-gray-700 leading-relaxed">
                Le catalogue «&nbsp;{catalogue.title}&nbsp;» est valable du {datesStr} et rassemble{" "}
                <strong>{actualOfferCount} offres</strong> sur <strong>{actualProductCount} produits</strong>
                {maxDiscountAll > 0 && (
                  <> avec des réductions <strong>jusqu&apos;à -{Math.round(maxDiscountAll)}%</strong></>
                )}.
                {categoryStats.length > 0 && (
                  <> Les rayons les mieux fournis&nbsp;: {categoryStats.slice(0, 3).map((c) => c.name).join(", ")}.</>
                )}
                {topDeals.length > 0 && (
                  <> À ne pas manquer&nbsp;: {topDeals.map((o) => `${o.product.name} (-${Math.round(o.discountPercentage ?? 0)}%)`).join(", ")}.</>
                )}
              </p>
            )}
            {categoryStats.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {categoryStats.map((c) => (
                  <li
                    key={c.name}
                    className="inline-flex w-auto max-w-full items-center gap-2 bg-gray-50 border border-gray-100 rounded-full pl-3.5 pr-1.5 py-1.5"
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
                      <span className="truncate font-semibold text-gray-900 text-[13px] leading-tight">{c.name}</span>
                      <span className="shrink-0 text-[11px] text-gray-500 leading-tight">
                        {c.offers} offre{c.offers > 1 ? "s" : ""}
                        {c.minPrice != null && <> · dès {c.minPrice.toLocaleString()} DH</>}
                      </span>
                    </span>
                    {c.maxDiscount > 0 && (
                      <span className="shrink-0 text-[11px] font-extrabold text-white bg-red-500 rounded-full px-2 py-0.5 leading-tight">
                        -{Math.round(c.maxDiscount)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mb-14" aria-label="Questions fréquentes">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl p-2.5 shadow-lg shadow-violet-200">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Questions fréquentes</h2>
              <p className="text-sm text-gray-500">Tout savoir sur ce catalogue</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
            {faqItems.map((f) => (
              <details key={f.q} className="group px-6 py-4">
                <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between gap-3">
                  {f.q}
                  <span className="shrink-0 text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-gray-600 text-sm leading-relaxed mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-8 mb-14">
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

        <CommentsSection target="catalogue" targetId={catalogue.id} />
        </main>

        <aside className="w-full lg:w-[340px] shrink-0 lg:sticky lg:top-20 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
          <CatalogueSidebar
            articles={JSON.parse(JSON.stringify(relatedArticles))}
            categories={JSON.parse(JSON.stringify(allCategories))}
          />
        </aside>
      </div>
    </div>
  );
}