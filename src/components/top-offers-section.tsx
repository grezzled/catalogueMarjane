"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import OfferModal from "@/components/offer-modal";

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const uploadsIdx = imagePath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    return "/" + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

interface Offer {
  id: string;
  originalPrice: number | null;
  salePrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  installmentAmount: number | null;
  installmentMonths: number | null;
  availability: string | null;
  conditions: string | null;
  promotionalDates: string | null;
  startDate: Date;
  endDate: Date;
  product: {
    name: string;
    category: string;
    brand: string | null;
    subcategory: string | null;
    specifications: string | null;
    imageUrl: string | null;
  };
  cataloguePage?: {
    pageNumber: number;
    imagePath: string | null;
  } | null;
}

interface TopOffersSectionProps {
  topOffers: Offer[];
  catalogueSlug: string;
  catalogueTitle?: string;
}

export default function TopOffersSection({ topOffers, catalogueSlug, catalogueTitle }: TopOffersSectionProps) {
  if (topOffers.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl p-2.5 shadow-lg shadow-blue-200">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Meilleures offres</h2>
          <p className="text-sm text-gray-500">Les deals les plus hot du moment</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {topOffers[0] && (
          <div className="lg:col-span-2 bg-gradient-to-br from-red-600 via-red-500 to-orange-400 rounded-xl p-4 text-white flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  TOP DEAL
                </span>
                <span className="text-white/60 text-xs">{topOffers[0].product.category}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-extrabold leading-tight truncate">{topOffers[0].product.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {topOffers[0].originalPrice && (
                      <span className="text-white/50 line-through text-sm">
                        {topOffers[0].originalPrice.toLocaleString()} DH
                      </span>
                    )}
                    {topOffers[0].salePrice && (
                      <span className="text-white font-extrabold text-2xl">
                        {topOffers[0].salePrice.toLocaleString()} <span className="text-xs">DH</span>
                      </span>
                    )}
                    {topOffers[0].discountPercentage && (
                      <span className="bg-white text-red-600 text-xs font-extrabold px-2 py-0.5 rounded-full">
                        -{Math.round(topOffers[0].discountPercentage)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center">
                    {topOffers[0].product.imageUrl && toImageUrl(topOffers[0].product.imageUrl) ? (
                      <img
                        src={toImageUrl(topOffers[0].product.imageUrl)!}
                        alt={topOffers[0].product.name}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-white/40" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            {topOffers[0].cataloguePage?.pageNumber && (
              <OfferModal offer={topOffers[0]} catalogueSlug={catalogueSlug} catalogueTitle={catalogueTitle}>
                <button className="mt-3 w-full sm:w-auto inline-flex items-center justify-center bg-white text-red-600 font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-white/90 transition-colors">
                  Voir l'offre
                </button>
              </OfferModal>
            )}
          </div>
        )}

        {topOffers[1] && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col">
            <div className="flex items-center gap-3 p-3 flex-1">
              <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                {topOffers[1].product.imageUrl && toImageUrl(topOffers[1].product.imageUrl) ? (
                  <img
                    src={toImageUrl(topOffers[1].product.imageUrl)!}
                    alt={topOffers[1].product.name}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Package className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                    {topOffers[1].product.category}
                  </span>
                  {topOffers[1].discountPercentage && (
                    <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                      -{Math.round(topOffers[1].discountPercentage)}%
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                  {topOffers[1].product.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  {topOffers[1].salePrice && (
                    <span className="text-blue-600 font-bold text-base">
                      {topOffers[1].salePrice.toLocaleString()} <span className="text-[10px]">DH</span>
                    </span>
                  )}
                  {topOffers[1].originalPrice && topOffers[1].originalPrice > (topOffers[1].salePrice ?? 0) && (
                    <span className="text-gray-400 line-through text-[10px]">
                      {topOffers[1].originalPrice.toLocaleString()} DH
                    </span>
                  )}
                </div>
              </div>
            </div>
            {topOffers[1].cataloguePage?.pageNumber && (
              <div className="px-3 pb-3">
                <OfferModal offer={topOffers[1]} catalogueSlug={catalogueSlug} catalogueTitle={catalogueTitle}>
                  <button className="block w-full bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors text-center">
                    Voir l'offre
                  </button>
                </OfferModal>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topOffers.slice(2, 5).map((offer) => (
          <div
            key={offer.id}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col"
          >
            <div className="flex items-center gap-3 p-3 flex-1">
              <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                {offer.product.imageUrl && toImageUrl(offer.product.imageUrl) ? (
                  <img
                    src={toImageUrl(offer.product.imageUrl)!}
                    alt={offer.product.name}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Package className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                    {offer.product.category}
                  </span>
                  {offer.discountPercentage && (
                    <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                      -{Math.round(offer.discountPercentage)}%
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                  {offer.product.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  {offer.salePrice && (
                    <span className="text-blue-600 font-bold text-base">
                      {offer.salePrice.toLocaleString()} <span className="text-[10px]">DH</span>
                    </span>
                  )}
                  {offer.originalPrice && offer.originalPrice > (offer.salePrice ?? 0) && (
                    <span className="text-gray-400 line-through text-[10px]">
                      {offer.originalPrice.toLocaleString()} DH
                    </span>
                  )}
                </div>
              </div>
            </div>
            {offer.cataloguePage?.pageNumber && (
              <div className="px-3 pb-3">
                <OfferModal offer={offer} catalogueSlug={catalogueSlug} catalogueTitle={catalogueTitle}>
                  <button className="block w-full bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors text-center">
                    Voir l'offre
                  </button>
                </OfferModal>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
