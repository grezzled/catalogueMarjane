import Link from "next/link";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata = {
  title: "Conditions d'utilisation - Catalogue Marjane Maroc",
  description:
    "Conditions d'utilisation de Catalogue Marjane : objet du site, indépendance vis-à-vis de Marjane, exactitude des informations, propriété intellectuelle et responsabilités.",
  alternates: {
    canonical: "/conditions-utilisation",
  },
  openGraph: {
    title: "Conditions d'utilisation - Catalogue Marjane Maroc",
    description:
      "Les règles d'utilisation de Catalogue Marjane, site d'information indépendant sur les catalogues et promotions Marjane au Maroc.",
    type: "website",
    url: "/conditions-utilisation",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Conditions d'utilisation - Catalogue Marjane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Conditions d'utilisation - Catalogue Marjane Maroc",
    description:
      "Les règles d'utilisation de Catalogue Marjane, site d'information indépendant sur les catalogues et promotions Marjane au Maroc.",
    images: ["/api/og"],
  },
};

export default function ConditionsUtilisationPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          {
            name: "Conditions d'utilisation",
            url: "/conditions-utilisation",
          },
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
            <span className="text-white font-medium">
              Conditions d&apos;utilisation
            </span>
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
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                Conditions d&apos;utilisation
              </h1>
              <p className="text-blue-200 mt-1">
                Les règles qui encadrent l&apos;utilisation de ce site
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            1. Objet du site
          </h2>
          <p className="text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Catalogue Marjane</strong> est une
            plateforme d&apos;information indépendante qui centralise les{" "}
            <Link
              href="/catalogue-marjane"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              catalogues Marjane
            </Link>
            , les{" "}
            <Link
              href="/promotions-marjane"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              promotions
            </Link>{" "}
            et des{" "}
            <Link
              href="/articles"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              articles et conseils
            </Link>{" "}
            afin d&apos;aider les consommateurs au Maroc à comparer les prix et
            à profiter des offres. En accédant à ce site, vous acceptez les
            présentes conditions d&apos;utilisation.
          </p>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            2. Indépendance : site non officiel
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Ce site est une initiative indépendante et{" "}
            <strong className="text-gray-900">
              n&apos;est ni affilié, ni approuvé, ni géré par Marjane
            </strong>
            . Les marques, logos et noms cités appartiennent à leurs
            propriétaires respectifs et sont mentionnés uniquement à des fins
            d&apos;information. Pour toute question sur un produit, un prix ou
            un stock, adressez-vous directement aux magasins ou aux canaux
            officiels de Marjane.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            3. Exactitude des informations
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Nous nous efforçons de présenter des informations exactes et à
            jour : dates de validité des catalogues, prix, remises et
            disponibilités. Toutefois, ces informations sont fournies{" "}
            <strong className="text-gray-900">à titre indicatif</strong> à
            partir des catalogues publics et peuvent contenir des erreurs ou
            devenir obsolètes. Les prix et les stocks peuvent varier selon les
            magasins. Vérifiez toujours les conditions en magasin avant tout
            achat : nous ne pouvons garantir l&apos;exactitude, l&apos;exhaustivité
            ni la disponibilité des offres affichées.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            4. Utilisation autorisée
          </h2>
          <p className="text-gray-600 leading-relaxed mb-3">
            Vous pouvez librement consulter le site pour un usage personnel et
            non commercial. En revanche, il est interdit de :
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 leading-relaxed">
            <li>
              Copier, republier ou exploiter automatiquement (scraping massif,
              aspiration) le contenu du site sans autorisation préalable.
            </li>
            <li>
              Perturber le fonctionnement du site, tenter d&apos;y accéder sans
              autorisation ou d&apos;en compromettre la sécurité.
            </li>
            <li>
              Utiliser le site ou son nom d&apos;une manière laissant croire à
              une affiliation avec Marjane ou avec ce site.
            </li>
            <li>
              Publier ou transmettre via le site tout contenu illicite,
              trompeur ou portant atteinte aux droits de tiers.
            </li>
          </ul>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            5. Propriété intellectuelle
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Sauf indication contraire, les textes, la présentation et les
            éléments graphiques propres à ce site sont protégés. Toute
            reproduction ou réutilisation sans autorisation est interdite. Les
            images de catalogues et les marques de tiers restent la propriété
            de leurs détenteurs respectifs et sont reproduites ici uniquement
            dans un but d&apos;information sur les offres.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            6. Liens externes et responsabilité
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Le site peut contenir des liens vers des sites tiers, sur lesquels
            nous n&apos;exerçons aucun contrôle et dont nous ne sommes pas
            responsables. L&apos;utilisation du site se fait à vos propres
            risques : dans les limites permises par la loi, nous déclinons
            toute responsabilité en cas de préjudice lié à l&apos;utilisation
            des informations publiées, à une interruption du service ou à une
            erreur dans les données affichées.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            7. Modifications et droit applicable
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Nous pouvons modifier les présentes conditions à tout moment ; la
            version applicable est celle publiée sur cette page au moment de
            votre visite. Ces conditions sont régies par le droit marocain.
            Pour toute question les concernant, consultez la page{" "}
            <Link
              href="/a-propos"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              À propos
            </Link>
            .
          </p>
        </section>

        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">
            Vous avez lu les conditions ?
          </h2>
          <p className="text-blue-200 mb-6">
            Retournez aux catalogues et aux promotions du moment.
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
