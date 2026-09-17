import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Package, TrendingDown, TrendingUp, Minus, ChevronRight, History } from "lucide-react";
import type { Metadata } from "next";
import { getProductDetail, getRelatedProducts } from "@/services/products";
import { getProductReviewSummary, getPublishedReviews } from "@/services/reviews";
import { formatDateFr } from "@/lib/utils";
import PriceHistoryChart from "@/components/price-history-chart";
import ProductCard from "@/components/product-card";
import RecentlyViewedLoader from "@/components/recently-viewed-loader";
import { RecordRecentView } from "@/components/recently-viewed";
import { AddToListButton } from "@/components/list-buttons";
import CommentsSection, { CommentCta } from "@/components/comments-section";
import ReviewsSection from "@/components/reviews-section";
import { BreadcrumbListJsonLd, ProductJsonLd } from "@/components/json-ld";

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Produit non trouvé" };

  const price = product.currentOffer?.salePrice ?? product.stats.lowest;
  // Same-name products (post-split clusters) share titles — disambiguate
  // with the price floor so each page has a unique <title>/meta.
  const displayName =
    product.duplicateName && product.stats.lowest != null
      ? `${product.name} — dès ${product.stats.lowest.toLocaleString()} DH`
      : product.name;
  const desc = price != null
    ? `${product.name} au meilleur prix : ${price.toLocaleString()} DH chez Marjane. Historique des prix, ${product.offerCount} offre${product.offerCount > 1 ? "s" : ""} suivie${product.offerCount > 1 ? "s" : ""}, promotions et bons plans au Maroc.`
    : `${product.name} : suivez son prix chez Marjane. Historique des prix et alertes promotions au Maroc.`;

  return {
    title: `${displayName} - Prix et historique | Catalogue Marjane`,
    description: desc,
    alternates: { canonical: `/produit/${product.slug}` },
    openGraph: {
      title: `${displayName} - ${price != null ? `${price.toLocaleString()} DH` : "Suivi de prix"}`,
      description: desc,
      type: "website",
      url: `/produit/${product.slug}`,
      siteName: "Catalogue Marjane",
    },
    twitter: { card: "summary_large_image", title: displayName, description: desc },
  };
}

function trendBadge(first: number | null, last: number | null) {
  if (first == null || last == null) return null;
  if (last < first)
    return (
      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
        <TrendingDown className="h-3.5 w-3.5" /> En baisse ({(((first - last) / first) * 100).toFixed(0)}%)
      </span>
    );
  if (last > first)
    return (
      <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
        <TrendingUp className="h-3.5 w-3.5" /> En hausse ({(((last - first) / first) * 100).toFixed(0)}%)
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
      <Minus className="h-3.5 w-3.5" /> Stable
    </span>
  );
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();
  // Old ID-based links canonicalize to the name slug.
  if (slug === product.id && product.slug !== product.id) redirect(`/produit/${product.slug}`);

  const related = await getRelatedProducts(product.id, product.category, product.brand);
  const [reviewSummary, recentReviews] = await Promise.all([
    getProductReviewSummary(product.id),
    getPublishedReviews(product.id, 10),
  ]);  const now = new Date();
  const current = product.currentOffer;
  const sales = product.history.map((h) => h.salePrice).filter((v): v is number => v != null);
  const firstPrice = sales[0] ?? null;
  const lastPrice = sales[sales.length - 1] ?? null;
  // Deep link to the exact catalogue page (viewer opens on it via #page-N).
  const pageUrl = (o: { catalogueSlug: string; pageNumber: number | null }) =>
    o.pageNumber != null ? `/catalogue-marjane/${o.catalogueSlug}#page-${o.pageNumber}` : `/catalogue-marjane/${o.catalogueSlug}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <RecordRecentView slug={product.slug} />
      <ProductJsonLd
        name={product.name}
        slug={product.slug}
        image={product.imageUrl}
        brand={product.brand}
        category={product.category}
        offers={product.history.map((h) => ({
          salePrice: h.salePrice,
          catalogueSlug: h.catalogueSlug,
          startDate: h.date,
          endDate: h.endDate,
        }))}
        reviewSummary={reviewSummary}
        reviews={recentReviews}
      />
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Produits", url: "/produits" },
          { name: product.name, url: `/produit/${product.slug}` },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6" aria-label="Fil d'Ariane">
          <Link href="/" className="hover:text-gray-900">Accueil</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/produits" className="hover:text-gray-900">Produits</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium truncate max-w-64 md:max-w-md">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-[320px_1fr] gap-8 mb-8">
          <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center min-h-72">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-80 object-contain" />
            ) : (
              <Package className="h-20 w-20 text-gray-300" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Link href={`/produits?categorie=${encodeURIComponent(product.category)}`} className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100">
                {product.category}
              </Link>
              {current ? (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                  <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span> En promotion
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-bold px-2 py-1 rounded-full">
                  Pas en promo actuellement
                </span>
              )}
              {trendBadge(firstPrice, lastPrice)}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{product.name}</h1>
            {product.brand && <p className="text-gray-500 mb-1">Marque : <span className="font-medium text-gray-700">{product.brand}</span></p>}
            {reviewSummary.count > 0 && reviewSummary.average != null ? (
              <a href="#avis" className="inline-flex items-center gap-1.5 text-sm mb-3 hover:opacity-80">
                <span className="text-amber-400 text-base leading-none">★</span>
                <span className="font-bold text-gray-900">{reviewSummary.average.toFixed(1)}</span>
                <span className="text-blue-600 hover:underline">({reviewSummary.count} avis)</span>
              </a>
            ) : (
              <a href="#avis" className="inline-block text-sm text-blue-600 hover:underline mb-3">
                Soyez le premier à noter ce produit ⭐
              </a>
            )}

            {current ? (
              <div className="bg-white rounded-lg shadow p-5 mb-4">
                <p className="text-sm text-gray-500">Prix actuel</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl font-bold text-red-600">{current.salePrice?.toLocaleString()} DH</span>
                  {current.originalPrice != null && current.salePrice != null && current.originalPrice > current.salePrice && (
                    <span className="text-gray-400 line-through text-xl">{current.originalPrice.toLocaleString()} DH</span>
                  )}
                  {current.discountPercentage != null && current.discountPercentage > 0 && (
                    <span className="bg-red-50 text-red-700 text-sm px-2 py-1 rounded font-bold">-{Math.round(current.discountPercentage)}%</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Chez Marjane jusqu&apos;au {formatDateFr(new Date(current.endDate))} ·{" "}
                  <Link href={pageUrl(current)} className="text-blue-600 hover:underline font-medium">
                    {current.catalogueTitle}{current.pageNumber != null ? ` · page ${current.pageNumber}` : ""}
                  </Link>
                </p>
              </div>
            ) : (
              product.stats.lowest != null && (
                <div className="bg-white rounded-lg shadow p-5 mb-4">
                  <p className="text-sm text-gray-500">Dernier prix observé</p>
                  <span className="text-4xl font-bold text-gray-900">{product.stats.lowest.toLocaleString()} DH</span>
                  <p className="text-sm text-gray-500 mt-1">Produit non promu en ce moment — son historique ci-dessous aide à décider s&apos;il faut attendre.</p>
                </div>
              )
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Plus bas", value: product.stats.lowest, color: "text-green-700" },
                { label: "Plus haut", value: product.stats.highest, color: "text-red-700" },
                { label: "Moyenne", value: product.stats.average != null ? Math.round(product.stats.average) : null, color: "text-gray-900" },
                { label: "Offres suivies", value: null, custom: `${product.offerCount}`, color: "text-gray-900" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-lg shadow p-3 text-center">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>
                    {s.custom ?? (s.value != null ? `${s.value.toLocaleString()} DH` : "—")}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AddToListButton slug={product.slug} />
              <CommentCta target="product" targetId={product.id} prompt="Avez-vous trouvé ce prix en magasin ?" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <History className="h-5 w-5" /> Historique des prix
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {product.offerCount === 1
              ? "1 prix relevé pour l'instant — l'historique s'enrichit à chaque nouveau catalogue."
              : `${product.offerCount} prix relevés ${product.stats.firstSeen ? `depuis le ${formatDateFr(new Date(product.stats.firstSeen))}` : ""}.`}
          </p>
          {product.history.length >= 2 ? (
            <PriceHistoryChart history={product.history} />
          ) : product.history.length === 1 ? (
            <p className="text-sm text-gray-500">Un seul relevé pour l&apos;instant — revenez après le prochain catalogue.</p>
          ) : (
            <p className="text-sm text-gray-500">Aucun prix relevé pour ce produit pour l&apos;instant.</p>
          )}
        </div>

        {product.history.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <h2 className="text-xl font-bold text-gray-900 p-5 pb-2">Toutes les offres</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catalogue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ancien prix</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Remise</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...product.history].reverse().map((h, i) => {
                    const isActive = new Date(h.date) <= now && new Date(h.endDate) >= now;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">{formatDateFr(new Date(h.date))} → {formatDateFr(new Date(h.endDate))}</td>
                        <td className="px-4 py-3">
                          <Link href={pageUrl(h)} className="text-blue-600 hover:underline font-medium">
                            {h.catalogueTitle}
                          </Link>
                          {h.pageNumber != null && (
                            <span className="text-gray-400 text-xs ml-1">· p.{h.pageNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                          {h.originalPrice != null ? `${h.originalPrice.toLocaleString()} DH` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold">
                          {h.salePrice != null ? `${h.salePrice.toLocaleString()} DH` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {h.discountPercentage != null && h.discountPercentage > 0 ? (
                            <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-medium">-{Math.round(h.discountPercentage)}%</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">En cours</span>
                          ) : (
                            <span className="text-gray-400 text-xs">Expiré</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Produits similaires</h2>
            <div className="grid grid-cols-1 min-[560px]:grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </div>
        )}

        <ReviewsSection productId={product.id} productName={product.name} />
        <RecentlyViewedLoader excludeSlug={product.slug} title="Vous avez aussi consulté" />
        <CommentsSection target="product" targetId={product.id} />
      </div>
    </div>
  );
}
