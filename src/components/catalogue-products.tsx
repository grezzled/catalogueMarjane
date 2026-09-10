"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Package } from "lucide-react";

interface CatalogueProductSectionProps {
  offers: Array<{
    id: string;
    salePrice: number | null;
    originalPrice: number | null;
    discountPercentage: number | null;
    cataloguePageId: string | null;
    product: {
      id: string;
      name: string;
      category: string;
      imageUrl: string | null;
    };
    cataloguePage?: {
      pageNumber: number;
    } | null;
  }>;
  catalogueSlug: string;
}

export default function CatalogueProductSection({ offers, catalogueSlug }: CatalogueProductSectionProps) {
  const [search, setSearch] = useState("");

  const filteredOffers = useMemo(() => {
    if (!search.trim()) return offers;
    const q = search.toLowerCase();
    return offers.filter(
      (o) =>
        o.product.name.toLowerCase().includes(q) ||
        o.product.category.toLowerCase().includes(q)
    );
  }, [offers, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredOffers>();
    for (const offer of filteredOffers) {
      const cat = offer.product.category || "Autre";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(offer);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredOffers]);

  const totalProducts = new Set(offers.map((o) => o.product.id)).size;

  return (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gray-100 rounded-lg p-2">
          <Package className="h-6 w-6 text-gray-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tous les produits</h2>
          <p className="text-sm text-gray-500">{totalProducts} produit{totalProducts !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un produit ou une catégorie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, catOffers]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-gray-900">{category}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {catOffers.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {catOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-red-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                        {offer.product.imageUrl ? (
                          <img
                            src={offer.product.imageUrl}
                            alt={offer.product.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Package className="h-8 w-8 text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900 font-semibold text-sm leading-snug line-clamp-2 mb-2">
                          {offer.product.name}
                        </p>
                        <div className="flex items-center gap-2">
                          {offer.salePrice && (
                            <span className="text-red-600 font-bold text-lg">
                              {offer.salePrice.toLocaleString()} <span className="text-xs">DH</span>
                            </span>
                          )}
                          {offer.discountPercentage && (
                            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                              -{Math.round(offer.discountPercentage)}%
                            </span>
                          )}
                        </div>
                        {offer.originalPrice && offer.originalPrice > (offer.salePrice ?? 0) && (
                          <span className="text-gray-400 line-through text-xs">
                            {offer.originalPrice.toLocaleString()} DH
                          </span>
                        )}
                        {offer.cataloguePageId && (
                          <Link
                            href={`/catalogue-marjane/${catalogueSlug}/page/${offer.cataloguePage?.pageNumber ?? ""}`}
                            className="inline-block mt-1.5 text-[10px] text-gray-500 hover:text-red-600 font-medium"
                          >
                            Page {offer.cataloguePage?.pageNumber}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
