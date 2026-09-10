"use client";

import { useState } from "react";
import { X, Package, Tag, Calendar, CreditCard, ShieldCheck } from "lucide-react";
import Link from "next/link";

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const uploadsIdx = imagePath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    return "/" + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

interface OfferModalProps {
  offer: {
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
    startDate: Date | string;
    endDate: Date | string;
    product: {
      name: string;
      category: string;
      brand: string | null;
      subcategory: string | null;
      specifications: string | null;
      imageUrl: string | null;
    };
    catalogue?: {
      slug: string;
      title: string;
    };
    cataloguePage?: {
      pageNumber: number;
      imagePath: string | null;
      aiAnalysis?: string | null;
    } | null;
  };
  catalogueSlug: string;
  catalogueTitle?: string;
  showFeatures?: boolean;
  showArticles?: boolean;
  children: React.ReactNode;
}

function parseSpecifications(specs: string | null): Record<string, string> | null {
  if (!specs) return null;
  try {
    return JSON.parse(specs);
  } catch {
    return null;
  }
}

function parseFeatures(aiAnalysis: string | null, productName: string): string[] {
  if (!aiAnalysis) return [];
  try {
    const analysis = JSON.parse(aiAnalysis);
    const product = analysis.products?.find((p: any) => p.name === productName);
    return product?.features || [];
  } catch {
    return [];
  }
}

export default function OfferModal({
  offer,
  catalogueSlug,
  catalogueTitle,
  showFeatures = false,
  showArticles = false,
  children,
}: OfferModalProps) {
  const [open, setOpen] = useState(false);
  const specs = parseSpecifications(offer.product.specifications);
  const features = showFeatures ? parseFeatures(offer.cataloguePage?.aiAnalysis || null, offer.product.name) : [];

  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none z-10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col md:flex-row">
              <div className="flex-1 min-w-0 p-6">
                <div className="flex gap-4">
                  <div className="shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                    {offer.product.imageUrl && toImageUrl(offer.product.imageUrl) ? (
                      <img
                        src={toImageUrl(offer.product.imageUrl)!}
                        alt={offer.product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                        {offer.product.category}
                      </span>
                      {offer.product.subcategory && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {offer.product.subcategory}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mt-2">
                      {offer.product.name}
                    </h2>
                    {offer.product.brand && (
                      <p className="text-sm text-gray-500 mt-0.5">{offer.product.brand}</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-5 text-center">
                  <div className="flex items-center justify-center gap-4">
                    {offer.originalPrice && (
                      <span className="text-gray-400 line-through text-lg">
                        {offer.originalPrice.toLocaleString()} DH
                      </span>
                    )}
                    {offer.salePrice && (
                      <span className="text-red-600 font-extrabold text-4xl tracking-tight">
                        {offer.salePrice.toLocaleString()} <span className="text-xl">DH</span>
                      </span>
                    )}
                  </div>
                  {offer.discountPercentage && (
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                        <Tag className="h-4 w-4" />
                        -{Math.round(offer.discountPercentage)}%
                      </span>
                      {offer.discountAmount && (
                        <span className="text-sm text-red-600 font-medium">
                          Économisez {offer.discountAmount.toLocaleString()} DH
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Validité</p>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">
                      {new Date(offer.startDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} — {new Date(offer.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {(catalogueTitle || offer.catalogue?.title) && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Catalogue</p>
                      <p className="text-sm text-gray-700 font-medium truncate">{catalogueTitle || offer.catalogue?.title}</p>
                    </div>
                  )}
                  {offer.installmentAmount && offer.installmentMonths && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Paiement</p>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">
                        {offer.installmentAmount.toLocaleString()} DH/mois × {offer.installmentMonths} mois
                      </p>
                    </div>
                  )}
                  {offer.availability && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Disponibilité</p>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{offer.availability}</p>
                    </div>
                  )}
                </div>

                {offer.conditions && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-yellow-700 uppercase tracking-wide mb-1">Conditions</p>
                    <p className="text-sm text-yellow-800">{offer.conditions}</p>
                  </div>
                )}

                {features.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Promotions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map((f, i) => (
                        <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {specs && Object.keys(specs).length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Spécifications</p>
                    <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                      {Object.entries(specs).map(([key, value]) => (
                        <div key={key} className="flex justify-between px-3 py-2">
                          <span className="text-xs text-gray-500">{key}</span>
                          <span className="text-xs text-gray-900 font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  {offer.cataloguePage && (
                    <Link
                      href={`/catalogue-marjane/${catalogueSlug}/page/${offer.cataloguePage.pageNumber}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold px-4 py-3 rounded-xl transition-colors text-center"
                    >
                      Voir la page {offer.cataloguePage.pageNumber}
                    </Link>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/catalogue-marjane/${catalogueSlug}/page/1`;
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-bold px-4 py-3 rounded-xl transition-colors text-center"
                  >
                    Tout le catalogue
                  </button>
                </div>
              </div>

              {offer.cataloguePage?.imagePath && toImageUrl(offer.cataloguePage.imagePath) && (
                <div className="shrink-0 w-full md:w-72 border-t md:border-t-0 md:border-l border-gray-100 bg-gray-50 flex items-center justify-center p-4">
                  <img
                    src={toImageUrl(offer.cataloguePage.imagePath)!}
                    alt={`Page ${offer.cataloguePage.pageNumber}`}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
