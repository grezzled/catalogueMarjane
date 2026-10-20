import Link from "next/link";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { MARJANE_OFFICIAL_URL } from "@/lib/links";

export const metadata = {
  title: "À propos - Catalogue Marjane Maroc",
  description:
    "À propos de Catalogue Marjane : notre mission, comment nous suivons les catalogues et promotions Marjane au Maroc, et notre indépendance en tant que site non officiel.",
  alternates: {
    canonical: "/a-propos",
  },
  openGraph: {
    title: "À propos - Catalogue Marjane Maroc",
    description:
      "Découvrez notre mission : suivre les catalogues et promotions Marjane au Maroc pour vous aider à faire des économies chaque semaine.",
    type: "website",
    url: "/a-propos",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "À propos - Catalogue Marjane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "À propos - Catalogue Marjane Maroc",
    description:
      "Découvrez notre mission : suivre les catalogues et promotions Marjane au Maroc pour vous aider à faire des économies chaque semaine.",
    images: ["/api/og"],
  },
};

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "À propos", url: "/a-propos" },
        ]}
      />
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <nav className="text-sm text-blue-200/70 mb-6 flex items-center gap-1.5">
            <Link href="/" className="hover:text-white transition-colors">
              Accueil
            </Link>
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
            <span className="text-white font-medium">À propos</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                À propos
              </h1>
              <p className="text-blue-200 mt-1">
                Qui sommes-nous et comment nous suivons les promotions Marjane
                au Maroc
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            À propos de Catalogue Marjane
          </h2>
          <p className="text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Catalogue Marjane</strong> est un
            site indépendant créé en 2026 par Echo Ls Solutions pour aider les
            consommateurs marocains à suivre les promotions des magasins
            Marjane et à acheter plus intelligemment.
          </p>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 mb-6">
          <p className="text-gray-600 leading-relaxed">
            Ce site{" "}
            <strong className="text-gray-900">n&apos;est pas affilié à Marjane</strong>.
            Les images, catalogues, noms de marque, produits, logos et marques
            appartiennent à leurs propriétaires respectifs. Retrouvez les
            informations officielles sur{" "}
            <a
              href={MARJANE_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium underline"
            >
              marjane.ma
            </a>
            .
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Ce que nous faisons
          </h2>
          <ul className="space-y-3 text-gray-600 leading-relaxed list-disc pl-6">
            <li>
              Nous rassemblons les catalogues promotionnels dans un format
              facile à parcourir sur votre mobile.
            </li>
            <li>
              Nous classons les offres par catégorie, par prix et par niveau de
              remise.
            </li>
            <li>
              Nous conservons un{" "}
              <strong className="text-gray-900">historique des prix</strong>{" "}
              pour vous aider à voir si une promotion est réellement
              intéressante.
            </li>
            <li>
              Nous publions des{" "}
              <Link
                href="/articles"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                guides d&apos;achat et des conseils
              </Link>{" "}
              rédigés par notre équipe pour vous aider à comparer et à choisir.
            </li>
          </ul>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Comment nous obtenons les informations
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Les informations proviennent des catalogues publics de Marjane. Nous
            les mettons à jour à chaque nouveau catalogue. Les prix et la
            disponibilité peuvent changer :{" "}
            <strong className="text-gray-900">
              vérifiez toujours le prix en magasin ou sur le site officiel de
              Marjane avant d&apos;acheter
            </strong>
            .
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Notre approche éditoriale
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Nos articles sont rédigés de manière indépendante. Nous ne recevons
            aucun paiement de Marjane pour mettre un produit en avant. Si le
            site affiche de la publicité, elle est clairement distincte du
            contenu éditorial.
          </p>
        </section>

        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Nous contacter</h2>
          <p className="text-blue-200 mb-6">
            Une erreur de prix, une suggestion, une question ? Écrivez-nous à{" "}
            <a
              href="mailto:echols.script@gmail.com"
              className="text-white font-medium underline"
            >
              echols.script@gmail.com
            </a>{" "}
            ou rejoignez notre chaîne WhatsApp.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
            >
              Formulaire de contact
            </Link>
            <a
              href="https://www.whatsapp.com/channel/0029Vb7qMcd96H4LjHryg43C"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              Chaîne WhatsApp
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
