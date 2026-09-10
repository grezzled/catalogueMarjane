"use client";

import React, { useState } from "react";

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
  const [open, setOpen] = useState(false);

  const features: string[] = (() => {
    if (offer.cataloguePage?.aiAnalysis) {
      try {
        const analysis = JSON.parse(offer.cataloguePage.aiAnalysis);
        const product = analysis.products?.find((p: any) => p.name === offer.product.name);
        return product?.features || [];
      } catch { return []; }
    }
    return [];
  })();

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
      >
        {offer.product.imageUrl && toImageUrl(offer.product.imageUrl) && (
          <img
            src={toImageUrl(offer.product.imageUrl)!}
            alt={offer.product.name}
            className="w-full h-32 object-contain mb-3 rounded"
          />
        )}
        <p className="text-xs text-gray-500 mb-1">
          {offer.product.category}
        </p>
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
              ×
            </button>
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 min-w-0 p-6">
                <div className="flex gap-4">
                  {offer.product.imageUrl && toImageUrl(offer.product.imageUrl) && (
                    <div className="shrink-0 w-32 h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <img
                        src={toImageUrl(offer.product.imageUrl)!}
                        alt={offer.product.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                      {offer.product.category}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 mt-2">
                      {offer.product.name}
                    </h2>
                    {offer.product.brand && (
                      <p className="text-sm text-gray-500 mt-0.5">{offer.product.brand}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-3">
                    {offer.originalPrice && (
                      <span className="text-gray-400 line-through text-base">
                        {offer.originalPrice.toLocaleString()} DH
                      </span>
                    )}
                    {offer.salePrice && (
                      <span className="text-red-600 font-extrabold text-3xl tracking-tight">
                        {offer.salePrice.toLocaleString()} <span className="text-lg">DH</span>
                      </span>
                    )}
                  </div>
                  {offer.discountPercentage && (
                    <div className="mt-2 flex justify-center">
                      <span className="inline-flex items-center gap-1 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                        -{Math.round(offer.discountPercentage)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Validité</p>
                    <p className="text-sm text-gray-700 font-medium">
                      {new Date(offer.startDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} — {new Date(offer.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">Catalogue</p>
                    <p className="text-sm text-gray-700 font-medium truncate">{offer.catalogue.title}</p>
                  </div>
                </div>

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

                {offer.catalogue.articles.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {offer.catalogue.articles.map((article) => (
                      <a
                        key={article.id}
                        href={`/articles/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium group"
                      >
                        <span className="bg-orange-100 group-hover:bg-orange-200 rounded-full p-1.5 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6z" /></svg>
                        </span>
                        {article.title}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <a
                    href={`/catalogue-marjane/${offer.catalogue.slug}/page/${offer.cataloguePage?.pageNumber || 1}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium group"
                  >
                    <span className="bg-blue-100 group-hover:bg-blue-200 rounded-full p-1.5 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                    </span>
                    Voir la page {offer.cataloguePage?.pageNumber} du catalogue
                  </a>
                </div>
              </div>
              {offer.cataloguePage?.imagePath && toImageUrl(offer.cataloguePage.imagePath) && (
                <div className="shrink-0 w-full md:w-72 border-l border-gray-100 bg-gray-50 flex items-center justify-center p-4">
                  <img
                    src={toImageUrl(offer.cataloguePage.imagePath)!}
                    alt={`Page ${offer.cataloguePage.pageNumber}`}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-sm"
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