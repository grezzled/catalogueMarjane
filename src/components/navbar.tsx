"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-600">Catalogue Marjane</span>
          <span className="hidden sm:inline text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">Site non officiel</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <Link
            href="/catalogue-marjane"
            className="text-gray-600 hover:text-gray-900"
          >
            Catalogues
          </Link>
          <Link
            href="/promotions-marjane"
            className="text-gray-600 hover:text-gray-900"
          >
            Promotions
          </Link>
          <Link
            href="/articles"
            className="text-gray-600 hover:text-gray-900"
          >
            Articles
          </Link>
          <Link href="/a-propos" className="text-gray-600 hover:text-gray-900">
            À propos
          </Link>
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
              href="/articles"
              className="block text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              Articles
            </Link>
            <Link
              href="/a-propos"
              className="block text-gray-600 hover:text-gray-900"
              onClick={() => setIsOpen(false)}
            >
              À propos
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
