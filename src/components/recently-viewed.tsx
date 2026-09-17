"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ProductResult } from "@/services/products";
import ProductCard from "@/components/product-card";
import { clearRecentViews, loadRecentViews, recordRecentView } from "@/lib/recently-viewed";

/** Invisible recorder — drop onto /produit/[slug]. */
export function RecordRecentView({ slug }: { slug: string }) {
  useEffect(() => {
    recordRecentView(slug);
  }, [slug]);
  return null;
}

/** Horizontal "Vus récemment" rail. Client-only (dynamic ssr:false at call
 *  sites): initial slugs come from a lazy initializer so there is no
 *  server/client hydration mismatch and no setState-in-effect. */
export function RecentlyViewed({ excludeSlug, title = "Vus récemment" }: { excludeSlug?: string; title?: string }) {
  const [slugs, setSlugs] = useState<string[]>(() =>
    loadRecentViews()
      .filter((s) => s !== excludeSlug)
      .slice(0, 10)
  );
  const [products, setProducts] = useState<Record<string, ProductResult>>({});
  const fetchKey = slugs.join("|");

  useEffect(() => {
    if (slugs.length === 0) return;
    let cancelled = false;
    fetch(`/api/products/batch?slugs=${encodeURIComponent(slugs.join(","))}`)
      .then(async (res) => {
        if (cancelled) return;
        const body = (await res.json().catch(() => null)) as { products?: ProductResult[] } | null;
        const map: Record<string, ProductResult> = {};
        for (const p of body?.products ?? []) {
          map[p.slug.toLowerCase()] = p;
          map[p.id.toLowerCase()] = p;
        }
        if (!cancelled) setProducts(map);
      })
      .catch(() => {
        // leave empty — rail stays hidden
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);
  const ordered = slugs
    .map((s) => products[s.toLowerCase()])
    .filter((p): p is ProductResult => !!p);
  if (ordered.length === 0) return null;

  return (
    <section className="mb-16" aria-label={title}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              clearRecentViews();
              setSlugs([]);
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Effacer
          </button>
          <Link href="/produits" className="text-sm text-blue-600 hover:text-blue-700 font-medium hidden sm:inline-flex items-center gap-1">
            Tous les produits
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide snap-x">
        {ordered.map((p) => (
          <div key={p.id} className="w-44 sm:w-52 shrink-0 snap-start">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
