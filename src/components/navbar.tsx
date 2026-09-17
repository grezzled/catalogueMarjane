"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, BookOpen, Tag, Search, Newspaper } from "lucide-react";
import { ShoppingListBadge } from "@/components/list-buttons";

const NAV_ITEMS = [
  { href: "/catalogue-marjane", label: "Catalogues", icon: BookOpen, match: (p: string) => p.startsWith("/catalogue-marjane") },
  { href: "/promotions-marjane", label: "Promotions", icon: Tag, match: (p: string) => p.startsWith("/promotions-marjane") },
  { href: "/produits", label: "Produits", icon: Search, match: (p: string) => p.startsWith("/produits") || p.startsWith("/produit") },
  { href: "/articles", label: "Articles", icon: Newspaper, match: (p: string) => p.startsWith("/articles") },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">Catalogue Marjane</span>
          <span className="hidden sm:inline text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">Site non officiel</span>
        </Link>

        <div className="hidden md:flex items-center gap-1.5 text-sm">
          {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
          <ShoppingListBadge />
        </div>

        <button
          className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-3">
            <Link
              href="/catalogue-marjane"
              className="block text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              Catalogues
            </Link>
            <Link
              href="/promotions-marjane"
              className="block text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              Promotions
            </Link>
            <Link
              href="/produits"
              className="block text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              Produits
            </Link>
            <Link
              href="/articles"
              className="block text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              Articles
            </Link>
            <span onClick={() => setIsOpen(false)} className="block">
              <ShoppingListBadge />
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
