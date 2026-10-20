"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, BookOpen, Tag, Search } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Accueil", icon: House, match: (p: string) => p === "/" },
  { href: "/catalogue-marjane", label: "Catalogues", icon: BookOpen, match: (p: string) => p.startsWith("/catalogue-marjane") },
  { href: "/promotions-marjane", label: "Promotions", icon: Tag, match: (p: string) => p.startsWith("/promotions-marjane") },
  { href: "/produits", label: "Produits", icon: Search, match: (p: string) => p.startsWith("/produits") || p.startsWith("/produit") },
];

/** Mobile-only bottom icon bar (md+ keeps the top navbar links). */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
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
