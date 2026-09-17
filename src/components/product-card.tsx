import Link from "next/link";
import { Package } from "lucide-react";
import type { ProductResult } from "@/services/products";
import { AddToListButton } from "@/components/list-buttons";

export default function ProductCard({ product }: { product: ProductResult }) {
  const active = !!product.currentOffer;
  return (
    <Link
      href={`/produit/${product.slug}`}
      className={`block h-full flex flex-col bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${!active ? "opacity-90" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-full h-32 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-1" loading="lazy" />
          ) : (
            <Package className="h-10 w-10 text-gray-300" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-500 truncate">{product.category}</span>
        {active ? (
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
            <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
            En cours
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
            Expiré
          </span>
        )}
        <span className="ml-auto">
          <AddToListButton compact slug={product.slug} />
        </span>
      </div>
      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 min-h-10">{product.name}</h3>
      {product.brand && <p className="text-xs text-gray-400 mt-0.5">{product.brand}</p>}
      <div className="mt-2 flex items-baseline gap-2">
        {product.bestPrice != null ? (
          <span className="text-red-600 font-bold text-lg">{product.bestPrice.toLocaleString()} DH</span>
        ) : (
          <span className="text-gray-400 text-sm">Prix à venir</span>
        )}
        {product.maxDiscount != null && product.maxDiscount > 0 && (
          <span className="inline-block bg-red-50 text-red-700 text-xs px-2 py-1 rounded font-medium">
            -{Math.round(product.maxDiscount)}%
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-auto pt-2">
        {product.offerCount === 1 ? "Vu dans 1 catalogue" : `Vu dans ${product.offerCount} catalogues`} ·{" "}
        <span className="text-blue-600 font-medium">Historique des prix →</span>
      </p>
    </Link>
  );
}
