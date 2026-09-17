import Link from "next/link";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import { searchProducts, getSearchFacets } from "@/services/products";
import ProductCard from "@/components/product-card";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Produits Marjane - Recherche et comparateur de prix",
  description:
    "Recherchez un produit et comparez son prix chez Marjane : historique des prix, meilleures offres, remises et promotions en cours au Maroc.",
  alternates: { canonical: "/produits" },
};

interface Props {
  searchParams: Promise<{
    q?: string;
    categorie?: string;
    marque?: string;
    remise?: string;
    prix_max?: string;
    promo?: string;
    tri?: string;
    page?: string;
  }>;
}

const SORT_OPTIONS = [
  { value: "relevant", label: "Pertinence" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "discount", label: "Plus grosse remise" },
  { value: "recent", label: "Vu récemment" },
];

function hrefWith(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...params, ...overrides })) {
    if (v) merged[k] = v;
  }
  const qs = new URLSearchParams(merged).toString();
  return `/produits${qs ? `?${qs}` : ""}`;
}

export default async function ProduitsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const categorie = sp.categorie || "";
  const marque = sp.marque || "";
  const remise = parseInt(sp.remise || "0", 10) || 0;
  const prixMax = sp.prix_max ? parseFloat(sp.prix_max) : undefined;
  const promo = sp.promo === "1";
  const tri = (sp.tri as "relevant" | "price-asc" | "price-desc" | "discount" | "recent") || "relevant";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const [facets, result] = await Promise.all([
    getSearchFacets(),
    searchProducts({
      q,
      category: categorie || undefined,
      brand: marque || undefined,
      minDiscount: remise > 0 ? remise : undefined,
      maxPrice: prixMax,
      inPromo: promo,
      sort: tri,
      page,
      perPage: 24,
    }),
  ]);

  const currentParams = {
    q: q || undefined,
    categorie: categorie || undefined,
    marque: marque || undefined,
    remise: remise > 0 ? String(remise) : undefined,
    prix_max: sp.prix_max || undefined,
    promo: promo ? "1" : undefined,
    tri: tri !== "relevant" ? tri : undefined,
  };
  const hasFilter = q !== "" || categorie !== "" || marque !== "" || remise > 0 || prixMax != null || promo;

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Produits", url: "/produits" },
        ]}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Produits</h1>
        <p className="text-gray-500 mb-6">
          Cherchez un produit, comparez les prix et consultez l&apos;historique complet de chaque offre Marjane.
        </p>

        <form method="GET" action="/produits" className="bg-white rounded-lg shadow p-4 md:p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Ex : lait, Samsung, cartable..."
                className="w-full pl-10 pr-3 py-2.5 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Chercher
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <label className="text-xs text-gray-500">
              Catégorie
              <select name="categorie" defaultValue={categorie} className="mt-1 w-full px-2 py-2.5 text-base sm:text-sm text-gray-900 border border-gray-300 rounded-lg bg-white min-h-11">
                <option value="">Toutes</option>
                {facets.categories.map((c) => (
                  <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Marque
              <select name="marque" defaultValue={marque} className="mt-1 w-full px-2 py-2.5 text-base sm:text-sm text-gray-900 border border-gray-300 rounded-lg bg-white min-h-11">
                <option value="">Toutes</option>
                {facets.brands.map((b) => (
                  <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Remise min.
              <select name="remise" defaultValue={remise > 0 ? String(remise) : ""} className="mt-1 w-full px-2 py-2.5 text-base sm:text-sm text-gray-900 border border-gray-300 rounded-lg bg-white min-h-11">
                <option value="">Toutes</option>
                <option value="10">-10% et plus</option>
                <option value="20">-20% et plus</option>
                <option value="30">-30% et plus</option>
                <option value="50">-50% et plus</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Prix max (DH)
              <input type="number" name="prix_max" defaultValue={sp.prix_max || ""} min={0} placeholder="Ex : 500" className="mt-1 w-full px-2 py-2.5 text-base sm:text-sm text-gray-900 border border-gray-300 rounded-lg min-h-11" />
            </label>
            <label className="text-xs text-gray-500 col-span-2 md:col-span-1">
              Trier par
              <select name="tri" defaultValue={tri} className="mt-1 w-full px-2 py-2.5 text-base sm:text-sm text-gray-900 border border-gray-300 rounded-lg bg-white min-h-11">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 py-1 pr-2 cursor-pointer">
              <input type="checkbox" name="promo" value="1" defaultChecked={promo} className="h-5 w-5 accent-blue-600" />
              En promotion actuellement
            </label>
            {hasFilter && (
              <Link href="/produits" className="text-sm text-blue-600 hover:underline">
                Réinitialiser
              </Link>
            )}
          </div>
        </form>

        <p className="text-sm text-gray-500 mb-4">
          {result.total === 0
            ? hasFilter
              ? "Aucun produit ne correspond à ces critères. Essayez un mot plus court ou retirez des filtres."
              : "Lancez une recherche ou choisissez des filtres pour explorer le catalogue produits."
            : `${result.total} produit${result.total > 1 ? "s" : ""} trouvé${result.total > 1 ? "s" : ""}${q ? ` pour « ${q} »` : ""} — page ${result.page}/${result.pageCount}. Cliquez sur un produit pour voir son historique des prix.`}
        </p>

        {result.results.length > 0 && (
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {result.results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {result.pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {result.page > 1 && (
              <Link href={hrefWith(currentParams, { page: String(result.page - 1) })} className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
                ← Précédent
              </Link>
            )}
            <span className="text-sm text-gray-500">Page {result.page} / {result.pageCount}</span>
            {result.page < result.pageCount && (
              <Link href={hrefWith(currentParams, { page: String(result.page + 1) })} className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50">
                Suivant →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
