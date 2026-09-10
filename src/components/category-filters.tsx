"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const DISCOUNT_RANGES = [
  { label: "Tous", min: 0, max: 100 },
  { label: "10%+", min: 10, max: 100 },
  { label: "20%+", min: 20, max: 100 },
  { label: "30%+", min: 30, max: 100 },
  { label: "40%+", min: 40, max: 100 },
  { label: "50%+", min: 50, max: 100 },
];

const SORT_OPTIONS = [
  { label: "Meilleure réduction", value: "discount-desc" },
  { label: "Prix croissant", value: "price-asc" },
  { label: "Prix décroissant", value: "price-desc" },
  { label: "Nouveautés", value: "newest" },
];

export default function CategoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentDiscount = searchParams.get("discount") ?? "all";
  const currentSort = searchParams.get("sort") ?? "discount-desc";
  const hasFilters = currentDiscount !== "all" || currentSort !== "discount-desc";

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "discount-desc") {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      return params.toString();
    },
    [searchParams]
  );

  const clearFilters = () => {
    router.push("?");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Réinitialiser
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Réduction</p>
          <div className="flex flex-wrap gap-1.5">
            {DISCOUNT_RANGES.map((range) => {
              const value = range.label === "Tous" ? "all" : `${range.min}`;
              const isActive = currentDiscount === value || (range.label === "Tous" && currentDiscount === "all");
              return (
                <button
                  key={range.label}
                  onClick={() => {
                    router.push(`?${createQueryString("discount", value)}`);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-red-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Trier par</p>
          <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map((option) => {
              const isActive = currentSort === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    router.push(`?${createQueryString("sort", option.value)}`);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-gray-800 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
