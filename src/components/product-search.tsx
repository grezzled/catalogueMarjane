"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

export default function ProductSearch({
  defaultValue = "",
  size = "md",
  preserveFilters = false,
}: {
  defaultValue?: string;
  size?: "md" | "lg";
  preserveFilters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (preserveFilters) {
      // Keep categorie / discount / sort / statut, only swap the query.
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      const s = params.toString();
      router.push(s ? `${pathname}?${s}` : pathname);
    } else {
      router.push(q ? `/promotions-marjane?q=${encodeURIComponent(q)}` : "/promotions-marjane");
    }
  }

  const inputClass =
    size === "lg"
      ? "w-full rounded-xl py-3.5 pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
      : "w-full rounded-lg py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={submit} className="w-full" role="search">
      <div className="relative">
        <svg
          className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ${size === "lg" ? "h-5 w-5" : "h-4 w-4"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Rechercher un produit, une marque..."
          aria-label="Rechercher un produit"
          className={inputClass}
        />
      </div>
    </form>
  );
}
