import Link from "next/link";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

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
            Notre mission
          </h2>
          <p className="text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Catalogue Marjane</strong> est une
            plateforme d&apos;information indépendante qui centralise les{" "}
            <Link
              href="/catalogue-marjane"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              catalogues Marjane
            </Link>{" "}
            et les{" "}
            <Link
              href="/promotions-marjane"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              promotions Marjane
            </Link>{" "}
            au Maroc. Notre objectif est simple : vous aider à ne rater aucune
            offre, comparer les prix et faire des économies chaque semaine sur
            l&apos;électroménager, l&apos;alimentation, la maison et le
            high-tech.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="bg-blue-100 rounded-lg p-2 w-fit mb-3">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">
              Catalogues à jour
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Les catalogues Marjane en cours et récents, avec leurs dates de
              validité, pages et produits.
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="bg-red-100 rounded-lg p-2 w-fit mb-3">
              <svg
                className="h-5 w-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6h.008v.008H6V6z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">
              Offres détaillées
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Chaque promotion avec prix avant et après, remise en % et en
              dirhams, et produit concerné.
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="bg-orange-100 rounded-lg p-2 w-fit mb-3">
              <svg
                className="h-5 w-5 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6z"
                />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">
              Guides d&apos;achat
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Des{" "}
              <Link
                href="/articles"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                articles et conseils
              </Link>{" "}
              pour comparer, choisir et profiter des meilleurs bons plans.
            </p>
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Comment ça marche ?
          </h2>
          <ol className="space-y-4 text-gray-600 leading-relaxed">
            <li className="flex gap-3">
              <span className="shrink-0 h-7 w-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                1
              </span>
              <p>
                <strong className="text-gray-900">Collecte :</strong> nous
                rassemblons les catalogues Marjane publiés chaque semaine, avec
                leurs pages, produits et prix.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 h-7 w-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                2
              </span>
              <p>
                <strong className="text-gray-900">Vérification :</strong> les
                dates de validité, prix et remises sont structurés et affichés
                clairement pour chaque offre.
              </p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 h-7 w-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                3
              </span>
              <p>
                <strong className="text-gray-900">Mise à jour :</strong> les
                catalogues expirés restent consultables en archive, tandis que
                les offres en cours sont mises en avant sur la page
                d&apos;accueil.
              </p>
            </li>
          </ol>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Site indépendant et non officiel
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Ce site est une initiative indépendante et{" "}
            <strong className="text-gray-900">
              n&apos;est ni affilié, ni approuvé, ni géré par Marjane
            </strong>
            . Les prix, disponibilités et conditions affichés sont fournis à
            titre indicatif à partir des catalogues publics : avant tout achat,
            vérifiez toujours les informations en magasin ou sur les canaux
            officiels de Marjane, car les stocks et les offres peuvent varier.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            À propos de Marjane
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Marjane est l&apos;une des principales enseignes d&apos;hypermarchés
            au Maroc, avec des magasins dans tout le royaume. Chaque semaine,
            l&apos;enseigne publie des catalogues avec des promotions sur
            l&apos;alimentaire, l&apos;électroménager, le textile, la maison et
            bien plus. Notre rôle est de rendre ces catalogues faciles à
            consulter en ligne, semaine après semaine.
          </p>
        </section>

        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">
            Prêt à faire des économies ?
          </h2>
          <p className="text-blue-200 mb-6">
            Parcourez les catalogues en cours et les meilleures promotions du
            moment.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/catalogue-marjane"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
            >
              Voir les catalogues
            </Link>
            <Link
              href="/promotions-marjane"
              className="inline-flex items-center gap-2 bg-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              Voir les promotions
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
