"use client";

import OfferModal from "@/components/offer-modal";
import { Package } from "lucide-react";

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const uploadsIdx = imagePath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    return "/" + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

interface OfferData {
  id: string;
  originalPrice: number | null;
  salePrice: number | null;
  discountPercentage: number | null;
  startDate: string;
  endDate: string;
  product: {
    name: string;
    category: string;
    brand: string | null;
    specifications: string | null;
    imageUrl: string | null;
  };
  catalogue: {
    slug: string;
    title: string;
    articles: {
      id: string;
      title: string;
      slug: string;
    }[];
  };
  cataloguePage: {
    imagePath: string | null;
    pageNumber: number;
    aiAnalysis: string | null;
  } | null;
}

export default function OfferCard({ offer }: { offer: OfferData }) {
  const now = new Date();
  const isActive = new Date(offer.startDate) <= now && new Date(offer.endDate) >= now;

  return (
    <OfferModal
      offer={{
        ...offer,
        startDate: offer.startDate,
        endDate: offer.endDate,
        discountAmount: null,
        installmentAmount: null,
        installmentMonths: null,
        availability: null,
        conditions: null,
        promotionalDates: null,
        product: {
          ...offer.product,
          subcategory: null,
        },
        catalogue: offer.catalogue,
      }}
      catalogueSlug={offer.catalogue.slug}
      catalogueTitle={offer.catalogue.title}
      showFeatures
    >
      <div className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${!isActive ? "opacity-90" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="w-full h-32 bg-gray-50 rounded-lg flex items-center justify-center">
            {offer.product.imageUrl && toImageUrl(offer.product.imageUrl) ? (
              <img
                src={toImageUrl(offer.product.imageUrl)!}
                alt={offer.product.name}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Package className="h-10 w-10 text-gray-300" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-gray-500">
            {offer.product.category}
          </span>
          {isActive ? (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
              En cours
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full" title="Offre expirée — prix indicatif, non disponible">
              Expiré · prix indicatif
            </span>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">
          {offer.product.name}
        </h3>
        <div className="mt-2 flex items-baseline gap-2">
          {offer.originalPrice && (
            <span className="text-gray-400 line-through text-sm">
              {offer.originalPrice.toLocaleString()} DH
            </span>
          )}
          {offer.salePrice && (
            <span className="text-red-600 font-bold text-lg">
              {offer.salePrice.toLocaleString()} DH
            </span>
          )}
        </div>
        {offer.discountPercentage && (
          <span className="inline-block mt-1 bg-red-50 text-red-700 text-xs px-2 py-1 rounded font-medium">
            -{Math.round(offer.discountPercentage)}%
          </span>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Valable du{" "}
          {new Date(offer.startDate).toLocaleDateString("fr-FR")} au{" "}
          {new Date(offer.endDate).toLocaleDateString("fr-FR")}
        </p>
      </div>
    </OfferModal>
  );
}
