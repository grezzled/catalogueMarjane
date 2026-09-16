import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgePercent, Flame, PiggyBank } from "lucide-react";
import { getDeal, getDealPageData, getDealProductCount, MIN_DEAL_PRODUCTS } from "@/lib/deals";
import OfferCard from "../offer-card";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

const DEAL_STYLE: Record<string, { Icon: typeof Flame; gradient: string }> = {
  "meilleures-promotions": {
    Icon: Flame,
    gradient: "from-red-500 to-orange-500",
  },
  "50-pourcent-et-plus": {
    Icon: BadgePercent,
    gradient: "from-violet-500 to-purple-600",
  },
  "moins-de-100-dh": {
    Icon: PiggyBank,
    gradient: "from-green-500 to-emerald-600",
  },
};

export async function dealMetadata(slug: string): Promise<Metadata> {
  const deal = getDeal(slug);
  if (!deal) return { title: "Page non trouvée" };
  const url = `/promotions-marjane/${slug}`;
  const count = await getDealProductCount(slug);
  // Below threshold the page 404s — keep it out of the index if ever seen.
  if (count === null || count < MIN_DEAL_PRODUCTS) {
    return { title: deal.metaTitle, robots: { index: false, follow: true } };
  }
  const description = deal.metaDescription(count);
  return {
    title: deal.metaTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: deal.metaTitle,
      description,
      type: "website",
      url,
      siteName: "Catalogue Marjane",
      images: [
        {
          url: "/api/og",
          width: 1200,
          height: 630,
          alt: deal.metaTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: deal.metaTitle,
      description,
      images: ["/api/og"],
    },
  };
}

export default async function DealPage({ slug }: { slug: string }) {
  const data = await getDealPageData(slug);
  // Unknown slug or not enough real data → no thin page.
  if (!data) notFound();
  const { deal, offers, productCount, topCategories } = data;
  const url = `/promotions-marjane/${slug}`;
  const { Icon, gradient } = DEAL_STYLE[slug] ?? {
    Icon: Flame,
    gradient: "from-red-500 to-orange-500",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Promotions", url: "/promotions-marjane" },
          { name: deal.label, url },
        ]}
      />
      <header className="relative bg-gradient-to-br from-orange-500 via-red-500 to-red-600 text-white overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-40 -bottom-32 h-72 w-72 rounded-full bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-10">
          <nav className="text-sm text-white/70 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">
              Accueil
            </Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <Link href="/promotions-marjane" className="hover:text-white transition-colors">
              Promotions
            </Link>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-white font-medium">{deal.label}</span>
          </nav>
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="mt-1 shrink-0 bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    {deal.title}
                  </h1>
                  <p className="text-orange-100 mt-1">{deal.countLine(productCount)}</p>
                </div>
              </div>
            </div>
            <div className="hidden lg:block shrink-0">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-6 text-center">
                <p className="text-5xl font-extrabold tracking-tight">{productCount}</p>
                <p className="text-orange-100 text-sm mt-1">produits en offre</p>
                <p className="text-white/60 text-xs mt-2 max-w-[180px]">
                  Mis à jour à chaque catalogue
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className={`bg-gradient-to-br ${gradient} rounded-lg p-2 shadow-lg`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Toutes les offres</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={JSON.parse(JSON.stringify(offer))} />
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 mt-10">
          <h2 className="text-xl font-bold text-gray-900 mb-3">{deal.title}</h2>
          <p className="text-gray-600 leading-relaxed">
            {deal.seoText(productCount, topCategories)}
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/promotions-marjane"
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Toutes les promotions
            </Link>
            <Link
              href="/catalogue-marjane"
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Voir les catalogues
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
