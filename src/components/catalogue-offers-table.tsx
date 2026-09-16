"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, Eye, ListFilter, Package, RotateCcw, Search } from "lucide-react";
import OfferModal from "@/components/offer-modal";
import type { ExplorerOffer } from "@/components/catalogue-page-explorer";

interface Props {
  offers: ExplorerOffer[];
  catalogueSlug: string;
  catalogueTitle?: string;
}

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const idx = imagePath.indexOf("uploads/");
  return idx !== -1 ? "/" + imagePath.slice(idx) : imagePath;
}

function detailsOf(o: ExplorerOffer): string {
  if (o.conditions?.trim()) return o.conditions.trim();
  const specs = o.product.specifications?.trim();
  if (specs) {
    try {
      const parsed: unknown = JSON.parse(specs);
      if (Array.isArray(parsed)) {
        const first = parsed.map(String).find((s) => s.trim());
        if (first) return first.slice(0, 80);
      } else if (typeof parsed === "object" && parsed !== null) {
        const vals = Object.values(parsed as Record<string, unknown>).map(String);
        const first = vals.find((s) => s.trim());
        if (first) return first.slice(0, 80);
      }
    } catch {
      return specs.split(/\r?\n/).find((s) => s.trim())?.slice(0, 80) ?? "";
    }
  }
  return o.product.subcategory ?? "";
}

function isLot(o: ExplorerOffer): boolean {
  const hay = `${o.product.name} ${o.conditions ?? ""} ${o.product.specifications ?? ""}`.toLowerCase();
  return /lot|pack|gros|pièces|pinceaux|feutres|bracelets|set|coffret|x\s?\d/i.test(hay);
}

type SortKey = "discount" | "priceAsc" | "priceDesc" | "name";

const PAGE_SIZES = [10, 20, 50];

export default function CatalogueOffersTable({ offers, catalogueSlug, catalogueTitle }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [bigDealOnly, setBigDealOnly] = useState(false);
  const [smallPriceOnly, setSmallPriceOnly] = useState(false);
  const [lotOnly, setLotOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("discount");
  const [pageSize, setPageSize] = useState(10);
  const [visible, setVisible] = useState(10);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const o of offers) if (o.product.category?.trim()) set.add(o.product.category.trim());
    return ["Toutes", ...[...set].sort((a, b) => a.localeCompare(b, "fr"))];
  }, [offers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = offers.filter((o) => {
      if (category !== "Toutes" && o.product.category !== category) return false;
      if (bigDealOnly && (o.discountPercentage ?? 0) < 40) return false;
      if (smallPriceOnly && (o.salePrice ?? Infinity) >= 100) return false;
      if (lotOnly && !isLot(o)) return false;
      if (q) {
        const hay = `${o.product.name} ${o.product.brand ?? ""} ${o.product.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "priceAsc":
          return (a.salePrice ?? Infinity) - (b.salePrice ?? Infinity);
        case "priceDesc":
          return (b.salePrice ?? -Infinity) - (a.salePrice ?? -Infinity);
        case "name":
          return a.product.name.localeCompare(b.product.name, "fr");
        case "discount":
        default:
          return (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0);
      }
    });
    return list;
  }, [offers, query, category, bigDealOnly, smallPriceOnly, lotOnly, sort]);

  const shown = filtered.slice(0, visible);
  const hasFilters =
    query.trim() !== "" || category !== "Toutes" || bigDealOnly || smallPriceOnly || lotOnly;

  function reset() {
    setQuery("");
    setCategory("Toutes");
    setBigDealOnly(false);
    setSmallPriceOnly(false);
    setLotOnly(false);
    setSort("discount");
    setPageSize(10);
    setVisible(10);
  }

  function toggleSort(key: "name" | SortKey) {
    if (key === "name") {
      setSort((s) => (s === "name" ? "discount" : "name"));
    }
  }

  return (
    <section className="mb-14" aria-label="Toutes les promotions">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-sky-500 to-blue-400 rounded-xl p-2.5 shadow-lg shadow-sky-200">
          <ListFilter className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Toutes les promotions</h2>
          <p className="text-sm text-gray-500">
            Recherchez et filtrez les {offers.length} offres du catalogue
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
        {/* Filter bar — inspired by the reference, adapted to site theme */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 text-white px-4 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] lg:grid-cols-[1.5fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="block text-sm font-medium text-blue-100 mb-1.5">Recherche libre</span>
              <span className="relative block">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisible(pageSize);
                  }}
                  placeholder="Ex : Riz, Blender, TV, Lait, Couches…"
                  className="w-full rounded-xl border-0 bg-white pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-white/70 focus:outline-none"
                />
              </span>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-blue-100 mb-1.5">Catégorie</span>
              <span className="relative block">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setVisible(pageSize);
                  }}
                  className="w-full appearance-none rounded-xl border-0 bg-white pl-3 pr-9 py-2.5 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-white/70 focus:outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-gray-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </span>
            </label>
            <button
              onClick={reset}
              disabled={!hasFilters && sort === "discount"}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/95 text-blue-800 text-sm font-bold px-4 py-2.5 hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-default md:col-span-2 lg:col-span-1"
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-blue-100 font-medium">Type d&apos;offre :</span>
            {[
              { label: "Grosse remise −40% et +", checked: bigDealOnly, set: setBigDealOnly },
              { label: "Petit prix −100 DH", checked: smallPriceOnly, set: setSmallPriceOnly },
              { label: "Lots / packs", checked: lotOnly, set: setLotOnly },
            ].map((t) => (
              <label key={t.label} className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={t.checked}
                  onChange={(e) => {
                    t.set(e.target.checked);
                    setVisible(pageSize);
                  }}
                  className="h-4 w-4 rounded accent-white"
                />
                <span className={t.checked ? "font-semibold" : "text-blue-50"}>{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3.5 border-b border-gray-100 text-sm">
          <span className="text-gray-600 shrink-0">Afficher</span>
          <span className="relative inline-flex shrink-0">
            <select
              value={pageSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPageSize(n);
                setVisible(n);
              }}
              aria-label="Nombre de produits affichés"
              className="appearance-none border border-gray-200 rounded-lg pl-2.5 pr-7 py-1 text-sm font-semibold text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer bg-white"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
          </span>
          <span className="text-gray-600 shrink-0">produits</span>
          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap ml-auto">
            {filtered.length} / {offers.length} offre{filtered.length > 1 ? "s" : ""}
          </span>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
            <span className="shrink-0">Tri</span>
            <span className="relative inline-flex min-w-0 max-w-[180px]">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="w-full appearance-none border border-gray-200 rounded-lg pl-2 pr-7 py-1 text-xs font-semibold text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer bg-white truncate"
              >
                <option value="discount">Meilleure remise</option>
                <option value="priceAsc">Prix croissant</option>
                <option value="priceDesc">Prix décroissant</option>
                <option value="name">Nom A–Z</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 shrink-0" />
            </span>
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            Aucune offre ne correspond à ces filtres.{" "}
            <button onClick={reset} className="text-blue-600 font-semibold hover:underline">
              Réinitialiser
            </button>
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-semibold">
                      <button
                        onClick={() => toggleSort("name")}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Produit
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Prix</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Remise</th>
                    <th className="px-4 py-3 font-semibold">Catégorie</th>
                    <th className="px-4 py-3 font-semibold w-10">
                      <span className="sr-only">Détail</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((o) => (
                    <tr key={o.id} className="hover:bg-blue-50/40 transition-colors align-middle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                            {o.product.imageUrl && toImageUrl(o.product.imageUrl) ? (
                              <img
                                src={toImageUrl(o.product.imageUrl)!}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-gray-300" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900 leading-snug line-clamp-2">
                              {o.product.name}
                            </span>
                            <span className="block text-xs text-gray-400 mt-0.5 truncate">
                              {[o.product.brand, detailsOf(o)].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {o.salePrice != null && (
                          <span className="block text-emerald-700 font-extrabold">
                            {o.salePrice.toLocaleString()} <span className="text-[11px] font-bold">DH</span>
                          </span>
                        )}
                        {o.originalPrice != null && (
                          <span className="block text-xs text-gray-400 line-through">
                            {o.originalPrice.toLocaleString()} DH
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {o.discountPercentage != null ? (
                          <>
                            <span className="inline-block text-xs font-extrabold text-white bg-red-500 rounded-full px-2 py-0.5">
                              -{Math.round(o.discountPercentage)}%
                            </span>
                            {o.discountAmount != null && (
                              <span className="block text-xs text-gray-500 mt-1 tabular-nums">
                                -{o.discountAmount.toLocaleString()} DH
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                          {o.product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <OfferModal
                          offer={o}
                          catalogueSlug={catalogueSlug}
                          catalogueTitle={catalogueTitle}
                          relatedOffers={offers.filter(
                            (r) => r.id !== o.id && r.product.category === o.product.category
                          )}
                        >
                          <span
                            role="button"
                            aria-label={`Voir ${o.product.name}`}
                            className="inline-flex w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 items-center justify-center transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </span>
                        </OfferModal>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-gray-100">
              {shown.map((o) => (
                <li key={o.id} className="px-4 py-3.5">
                  <OfferModal
                    offer={o}
                    catalogueSlug={catalogueSlug}
                    catalogueTitle={catalogueTitle}
                    relatedOffers={offers.filter(
                      (r) => r.id !== o.id && r.product.category === o.product.category
                    )}
                  >
                    <span className="flex items-center gap-3 text-left w-full">
                      <span className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                        {o.product.imageUrl && toImageUrl(o.product.imageUrl) ? (
                          <img
                            src={toImageUrl(o.product.imageUrl)!}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-gray-300" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                          {o.product.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                          {o.salePrice != null && (
                            <span className="text-emerald-700 font-extrabold text-sm whitespace-nowrap">
                              {o.salePrice.toLocaleString()} DH
                            </span>
                          )}
                          {o.discountPercentage != null && (
                            <span className="text-[11px] font-extrabold text-white bg-red-500 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                              -{Math.round(o.discountPercentage)}%
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 truncate">{o.product.category}</span>
                        </span>
                      </span>
                      <Eye className="h-4 w-4 text-emerald-700 shrink-0" />
                    </span>
                  </OfferModal>
                </li>
              ))}
            </ul>

            {visible < filtered.length && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-100 text-center">
                <button
                  onClick={() => setVisible((v) => v + pageSize)}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  Voir plus ({filtered.length - visible} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
