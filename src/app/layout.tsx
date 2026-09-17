import "./globals.css";
import Link from "next/link";
import Navbar from "@/components/navbar";
import BottomNav from "@/components/bottom-nav";
import WhatsAppFloat from "@/components/whatsapp-float";
import PageviewTracker from "@/components/pageview-tracker";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://cataloguemarjane.com"),
  title: {
    template: "%s",
    default: "Catalogue Marjane - Promotions et Offres au Maroc",
  },
  description:
    "Découvrez les catalogues Marjane avec toutes les promotions, offres et bons plans au Maroc.",
  openGraph: {
    title: "Catalogue Marjane - Promotions et Offres au Maroc",
    description: "Découvrez les promotions Marjane : électroménager, alimentation, high-tech, maison et plus au Maroc.",
    url: "/",
    siteName: "Catalogue Marjane",
    locale: "fr_MA",
    type: "website",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Catalogue Marjane - Promotions et Offres",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalogue Marjane - Promotions et Offres au Maroc",
    description: "Découvrez les promotions Marjane : électroménager, alimentation, high-tech, maison et plus au Maroc.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <PageviewTracker />
        <Navbar />
        <main>{children}</main>
        <footer className="bg-gray-900 text-gray-400 mt-16">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr] gap-10">
              <div>
                <Link href="/" className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">
                    Catalogue Marjane
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 bg-white/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Site non officiel
                  </span>
                </Link>
                <p className="text-sm mt-3 leading-relaxed max-w-sm">
                  Toutes les promotions et offres Marjane au Maroc :
                  catalogues, bons plans et guides d&apos;achat, mis à jour
                  chaque semaine.
                </p>
              </div>
              <nav aria-label="Explorer">
                <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">
                  Explorer
                </h3>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <Link
                      href="/catalogue-marjane"
                      className="hover:text-white transition-colors"
                    >
                      Catalogues
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/promotions-marjane"
                      className="hover:text-white transition-colors"
                    >
                      Promotions
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/articles"
                      className="hover:text-white transition-colors"
                    >
                      Articles
                    </Link>
                  </li>
                </ul>
              </nav>
              <nav aria-label="Informations">
                <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">
                  Informations
                </h3>
                <ul className="space-y-2.5 text-sm">
                  <li>
                    <Link
                      href="/a-propos"
                      className="hover:text-white transition-colors"
                    >
                      À propos
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/conditions-utilisation"
                      className="hover:text-white transition-colors"
                    >
                      Conditions d&apos;utilisation
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/politique-confidentialite"
                      className="hover:text-white transition-colors"
                    >
                      Politique de confidentialité
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
              <p>
                © {new Date().getFullYear()} Catalogue Marjane. Tous droits
                réservés.
              </p>
              <p className="text-gray-500 text-xs">
                Site indépendant, non affilié à Marjane.
              </p>
            </div>
          </div>
        </footer>
        <BottomNav />
        <WhatsAppFloat />
      </body>
    </html>
  );
}
