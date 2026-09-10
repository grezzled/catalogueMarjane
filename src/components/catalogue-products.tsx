"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Package } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import OfferModal from "@/components/offer-modal";

interface CatalogueProductSectionProps {
  offers: Array<{
    id: string;
    salePrice: number | null;
    originalPrice: number | null;
    discountPercentage: number | null;
    cataloguePageId: string | null;
    startDate: Date | string;
    endDate: Date | string;
    product: {
      id: string;
      name: string;
      category: string;
      brand: string | null;
      specifications: string | null;
      imageUrl: string | null;
    };
    cataloguePage?: {
      pageNumber: number;
      imagePath: string | null;
    } | null;
  }>;
  catalogueSlug: string;
  catalogueTitle: string;
}

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const uploadsIdx = imagePath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    return "/" + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

export default function CatalogueProductSection({ offers, catalogueSlug, catalogueTitle }: CatalogueProductSectionProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>(null);

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
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredOffers]);

  const categories = grouped.map(([name, catOffers]) => ({ name, count: catOffers.length }));

  const currentTab = activeTab || (grouped.length > 0 ? grouped[0][0] : null);
  const currentOffers = grouped.find(([name]) => name === currentTab)?.[1] || [];

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
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun produit trouvé</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
            {categories.map(({ name, count }) => {
              const Icon = getCategoryIcon(name);
              return (
                <button
                  key={name}
                  onClick={() => setActiveTab(name)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                    currentTab === name
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {name}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    currentTab === name ? "bg-white/20" : "bg-gray-100"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {currentOffers.map((offer) => (
              <OfferModal
                key={offer.id}
                offer={{
                  id: offer.id,
                  originalPrice: offer.originalPrice,
                  salePrice: offer.salePrice,
                  discountPercentage: offer.discountPercentage,
                  discountAmount: null,
                  installmentAmount: null,
                  installmentMonths: null,
                  availability: null,
                  conditions: null,
                  promotionalDates: null,
                  startDate: offer.startDate,
                  endDate: offer.endDate,
                  product: {
                    name: offer.product.name,
                    category: offer.product.category,
                    brand: offer.product.brand,
                    subcategory: null,
                    specifications: offer.product.specifications,
                    imageUrl: offer.product.imageUrl,
                  },
                  cataloguePage: offer.cataloguePage ? {
                    pageNumber: offer.cataloguePage.pageNumber,
                    imagePath: offer.cataloguePage.imagePath,
                  } : null,
                }}
                catalogueSlug={catalogueSlug}
                catalogueTitle={catalogueTitle}
              >
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                      {offer.product.imageUrl ? (
                        <img
                          src={toImageUrl(offer.product.imageUrl) || ""}
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
                          <span className="text-blue-600 font-bold text-lg">
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
                        <span className="inline-flex items-center justify-center mt-3 w-full bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                          Voir l'offre
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </OfferModal>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
