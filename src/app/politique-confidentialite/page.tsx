import Link from "next/link";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata = {
  title: "Politique de confidentialité - Catalogue Marjane Maroc",
  description:
    "Politique de confidentialité de Catalogue Marjane : données collectées, cookies, utilisation, partage, sécurité et vos droits conformément à la loi 09-08 au Maroc.",
  alternates: {
    canonical: "/politique-confidentialite",
  },
  openGraph: {
    title: "Politique de confidentialité - Catalogue Marjane Maroc",
    description:
      "Comment Catalogue Marjane collecte, utilise et protège vos données personnelles lorsque vous consultez les catalogues et promotions Marjane au Maroc.",
    type: "website",
    url: "/politique-confidentialite",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Politique de confidentialité - Catalogue Marjane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Politique de confidentialité - Catalogue Marjane Maroc",
    description:
      "Comment Catalogue Marjane collecte, utilise et protège vos données personnelles lorsque vous consultez les catalogues et promotions Marjane au Maroc.",
    images: ["/api/og"],
  },
};

export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          {
            name: "Politique de confidentialité",
            url: "/politique-confidentialite",
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
              Politique de confidentialité
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
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">
                Politique de confidentialité
              </h1>
              <p className="text-blue-200 mt-1">
                Comment nous protégeons vos données personnelles
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            1. Qui sommes-nous ?
          </h2>
          <p className="text-gray-600 leading-relaxed">
            <strong className="text-gray-900">Catalogue Marjane</strong> est un
            site d&apos;information indépendant qui centralise les catalogues
            et promotions Marjane au Maroc. Il{" "}
            <strong className="text-gray-900">
              n&apos;est ni affilié, ni approuvé, ni géré par Marjane
            </strong>
            . La présente politique explique quelles données nous collectons
            lorsque vous utilisez le site, pourquoi, et quels sont vos droits.
            Pour en savoir plus sur le site, consultez la page{" "}
            <Link
              href="/a-propos"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              À propos
            </Link>
            .
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            2. Données que nous collectons
          </h2>
          <p className="text-gray-600 leading-relaxed mb-3">
            La consultation des{" "}
            <Link
              href="/catalogue-marjane"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              catalogues
            </Link>
            , des{" "}
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
              articles
            </Link>{" "}
            ne nécessite aucune inscription. Nous ne collectons que :
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 leading-relaxed">
            <li>
              <strong className="text-gray-900">
                Données techniques automatiques :
              </strong>{" "}
              adresse IP, type d&apos;appareil et de navigateur, pages visitées
              et horodatage, via les journaux standards du serveur et les
              outils de mesure d&apos;audience.
            </li>
            <li>
              <strong className="text-gray-900">Cookies :</strong> petits
              fichiers stockés sur votre appareil pour le fonctionnement du
              site (préférences, sécurité) et, le cas échéant, la mesure
              d&apos;audience et la publicité (voir section 4).
            </li>
            <li>
              <strong className="text-gray-900">
                Données que vous nous transmettez :
              </strong>{" "}
              uniquement si vous nous contactez (par exemple votre adresse
              e-mail et le contenu de votre message).
            </li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-3">
            Nous ne collectons pas volontairement de données sensibles et le
            site ne s&apos;adresse pas spécifiquement aux enfants.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            3. Utilisation des données
          </h2>
          <p className="text-gray-600 leading-relaxed mb-3">
            Vos données sont utilisées uniquement pour :
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-600 leading-relaxed">
            <li>Faire fonctionner le site et assurer sa sécurité.</li>
            <li>
              Comprendre la fréquentation (pages les plus consultées) afin
              d&apos;améliorer le contenu.
            </li>
            <li>
              Répondre à vos messages lorsque vous nous contactez.
            </li>
            <li>
              Respecter nos obligations légales, le cas échéant.
            </li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-3">
            Nous ne vendons ni ne louons vos données personnelles à des tiers.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            4. Cookies et mesure d&apos;audience
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Le site peut utiliser des cookies strictement nécessaires à son
            fonctionnement ainsi que des cookies de mesure d&apos;audience pour
            comprendre comment les visiteurs utilisent le site. Vous pouvez à
            tout moment refuser ou supprimer les cookies depuis les paramètres
            de votre navigateur ; certaines fonctionnalités du site peuvent
            alors être limitées. Si des services tiers (mesure d&apos;audience,
            publicité) sont activés, ils peuvent déposer leurs propres cookies
            selon leurs propres politiques.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            5. Partage et conservation
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Vos données ne sont partagées qu&apos;avec les prestataires
            techniques strictement nécessaires à l&apos;hébergement et au
            fonctionnement du site, ou lorsque la loi l&apos;exige. Les
            journaux techniques sont conservés pour une durée limitée,
            proportionnée à leur finalité (sécurité, statistiques), puis
            supprimés ou anonymisés. Les messages que vous nous envoyez sont
            conservés uniquement le temps nécessaire à leur traitement.
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            6. Vos droits
          </h2>
          <p className="text-gray-600 leading-relaxed mb-3">
            Conformément à la loi n° 09-08 relative à la protection des
            personnes physiques à l&apos;égard du traitement des données à
            caractère personnel au Maroc, vous disposez d&apos;un droit
            d&apos;accès, de rectification et d&apos;opposition concernant vos
            données personnelles. Pour exercer ces droits ou poser une question
            sur cette politique, contactez-nous en précisant votre demande.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Vous pouvez également adresser une réclamation à la Commission
            Nationale de contrôle de la protection des Données à caractère
            Personnel (CNDP).
          </p>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            7. Sécurité et modifications
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Nous mettons en œuvre des mesures raisonnables pour protéger vos
            données contre tout accès non autorisé, perte ou altération, sans
            pouvoir garantir une sécurité absolue. Nous pouvons mettre à jour
            la présente politique à tout moment ; la version applicable est
            celle publiée sur cette page au moment de votre visite. Pour les
            règles générales d&apos;utilisation du site, consultez les{" "}
            <Link
              href="/conditions-utilisation"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              conditions d&apos;utilisation
            </Link>
            .
          </p>
        </section>

        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">
            Une question sur vos données ?
          </h2>
          <p className="text-blue-200 mb-6">
            En attendant, retrouvez les catalogues et promotions du moment.
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
