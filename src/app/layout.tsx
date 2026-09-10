import "./globals.css";
import Link from "next/link";
import Navbar from "@/components/navbar";

export const metadata = {
  title: {
    template: "%s | Catalogue Marjane",
    default: "Catalogue Marjane - Promotions et Offres au Maroc",
  },
  description:
    "Découvrez les catalogues Marjane avec toutes les promotions, offres et bons plans au Maroc.",
  icons: {
    icon: "/favicon.svg",
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
        <Navbar />
        <main>{children}</main>
        <footer className="bg-gray-900 text-gray-400 mt-16">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-white font-semibold mb-3">
                  Catalogue Marjane
                </h3>
                <p className="text-sm">
                  Toutes les promotions et offres Marjane au Maroc.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-3">Liens</h3>
                <div className="space-y-2 text-sm">
                  <Link
                    href="/catalogue-marjane"
                    className="block hover:text-white"
                  >
                    Catalogues
                  </Link>
                  <Link
                    href="/promotions-marjane"
                    className="block hover:text-white"
                  >
                    Promotions
                  </Link>
                  <Link href="/articles" className="block hover:text-white">
                    Articles
                  </Link>
                </div>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-3">À propos</h3>
                <p className="text-sm">
                  Plateforme d&apos;information sur les catalogues et promotions
                  Marjane au Maroc.
                </p>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-6 text-center text-sm">
              © {new Date().getFullYear()} Catalogue Marjane. Tous droits
              réservés.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
