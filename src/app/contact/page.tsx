import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import ContactForm from "@/components/contact-form";
import { WHATSAPP_CHANNEL_URL } from "@/lib/links";

const CONTACT_EMAIL = "echols.script@gmail.com";

export const metadata = {
  title: "Contact - Catalogue Marjane",
  description:
    "Contactez l'équipe de Catalogue Marjane : erreur de prix, suggestion ou question. Écrivez-nous à echols.script@gmail.com ou via le formulaire de contact.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact - Catalogue Marjane",
    description:
      "Une erreur de prix, une suggestion, une question ? Contactez l'équipe de Catalogue Marjane.",
    type: "website",
    url: "/contact",
    siteName: "Catalogue Marjane",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Contact - Catalogue Marjane",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact - Catalogue Marjane",
    description:
      "Une erreur de prix, une suggestion, une question ? Contactez l'équipe de Catalogue Marjane.",
    images: ["/api/og"],
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BreadcrumbListJsonLd
        items={[
          { name: "Accueil", url: "/" },
          { name: "Contact", url: "/contact" },
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
            <span className="text-white font-medium">Contact</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <Mail className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight">Contact</h1>
              <p className="text-blue-200 mt-1">
                Une erreur de prix, une suggestion, une question ? Écrivez-nous.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Envoyez-nous un message
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              Remplissez le formulaire ci-dessous et nous vous répondrons dans
              les meilleurs délais.
            </p>
            <ContactForm />
          </section>

          <aside className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                Nous contacter directement
              </h2>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
              >
                <span className="bg-blue-100 rounded-lg p-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">
                    E-mail
                  </span>
                  <span className="block text-sm text-blue-600 break-all">
                    {CONTACT_EMAIL}
                  </span>
                </span>
              </a>
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-start gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
              >
                <span className="bg-green-100 rounded-lg p-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">
                    Chaîne WhatsApp
                  </span>
                  <span className="block text-sm text-green-600">
                    Suivre les promotions
                  </span>
                </span>
              </a>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm text-gray-600 leading-relaxed">
              <p className="font-semibold text-gray-900 mb-1.5">
                Délai de réponse
              </p>
              <p>
                Nous répondons généralement sous 48 heures ouvrées. Pour une
                erreur de prix, précisez le produit et le catalogue concernés.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
