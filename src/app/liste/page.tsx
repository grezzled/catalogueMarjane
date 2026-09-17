import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ShoppingListManager from "@/components/shopping-list-manager";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "Ma liste de courses - Catalogue Marjane",
  description:
    "Préparez vos courses : liste de produits Marjane avec prix estimés, partageable et imprimable.",
  alternates: { canonical: "/liste" },
  robots: { index: false, follow: true },
};

export default function ListePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Ma liste", url: "/liste" },
        ]}
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="no-print flex items-center gap-1 text-sm text-gray-500 mb-4" aria-label="Fil d'Ariane">
          <Link href="/" className="hover:text-gray-900">Accueil</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">Ma liste</span>
        </nav>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Ma liste de courses</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Cochez au fur et à mesure en magasin, partagez-la à vos proches ou imprimez-la. Conservée sur cet appareil.
        </p>
        <Suspense fallback={<p className="text-sm text-gray-500">Chargement…</p>}>
          <ShoppingListManager />
        </Suspense>
      </div>
    </div>
  );
}
