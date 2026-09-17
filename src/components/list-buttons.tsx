"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ListPlus, ShoppingCart } from "lucide-react";
import { addToList, loadList, onListChange, removeFromList } from "@/lib/shopping-list";

/** "＋ Liste" toggle button — drops onto product cards, pages and modals. */
export function AddToListButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const [inList, setInList] = useState(() => loadList().some((i) => i.slug === slug));

  useEffect(() => {
    return onListChange(() => setInList(loadList().some((i) => i.slug === slug)));
  }, [slug]);

  function toggle() {
    if (inList) removeFromList(slug);
    else addToList(slug);
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        title={inList ? "Dans votre liste ✓ — retirer ?" : "Ajouter à ma liste"}
        aria-label={inList ? "Retirer de ma liste" : "Ajouter à ma liste"}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          inList ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
        }`}
      >
        {inList ? <Check className="h-4 w-4" strokeWidth={3} /> : <ListPlus className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
        inList ? "bg-green-600 text-white hover:bg-green-700" : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {inList ? <Check className="h-4 w-4" strokeWidth={3} /> : <ListPlus className="h-4 w-4" />}
      {inList ? "Dans la liste ✓" : "＋ Ma liste"}
    </button>
  );
}

/** Navbar icon with live item count badge. */
export function ShoppingListBadge() {
  const [count, setCount] = useState(() => loadList().length);

  useEffect(() => {
    return onListChange(() => setCount(loadList().length));
  }, []);

  return (
    <Link
      href="/liste"
      aria-label={count > 0 ? `Ma liste (${count} produits)` : "Ma liste"}
      title="Ma liste"
      className="relative text-gray-600 hover:text-gray-900 inline-flex items-center p-1"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1 py-px tabular-nums min-w-4 text-center leading-tight">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
