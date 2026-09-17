"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, BookOpen, Tag, Search, ShoppingCart } from "lucide-react";
import { loadList, onListChange } from "@/lib/shopping-list";

const ITEMS = [
  { href: "/", label: "Accueil", icon: House, match: (p: string) => p === "/" },
  { href: "/catalogue-marjane", label: "Catalogues", icon: BookOpen, match: (p: string) => p.startsWith("/catalogue-marjane") },
  { href: "/promotions-marjane", label: "Promotions", icon: Tag, match: (p: string) => p.startsWith("/promotions-marjane") },
  { href: "/produits", label: "Produits", icon: Search, match: (p: string) => p.startsWith("/produits") || p.startsWith("/produit") },
  { href: "/liste", label: "Ma liste", icon: ShoppingCart, match: (p: string) => p.startsWith("/liste") },
];

/** Mobile-only bottom icon bar (md+ keeps the top navbar links). */
export default function BottomNav() {
  const pathname = usePathname();
  const [listCount, setListCount] = useState(0);

  useEffect(() => {
    return onListChange(() => setListCount(loadList().length));
  }, []);

  // Initial count without setState-in-effect: sync on first interaction-safe tick.
  useEffect(() => {
    const t = window.setTimeout(() => setListCount(loadList().length), 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={label}
                className={`relative flex items-center justify-center py-3 transition-colors ${
                  active ? "text-blue-600" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-blue-600" aria-hidden />}
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                {href === "/liste" && listCount > 0 && (
                  <span className="absolute top-1 right-1/2 translate-x-4 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1 py-px tabular-nums min-w-4 text-center leading-tight">
                    {listCount > 99 ? "99+" : listCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      {/* Spacer so the bar never covers page content */}
      <div className="md:hidden h-[52px]" aria-hidden style={{ marginBottom: "env(safe-area-inset-bottom)" }} />
    </>
  );
}
