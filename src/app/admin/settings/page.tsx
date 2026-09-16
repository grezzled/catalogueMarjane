"use client";

import { useEffect, useState } from "react";

interface OGSettings {
  bannerTitle: string;
  bannerTitleAr: string;
  bannerSubtitle: string;
  bannerSubtitleAr: string;
  bodyText: string;
  bodyTextAr: string;
  coverPages: number;
  defaultLang: "fr" | "ar";
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<OGSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<"fr" | "ar">("fr");

  useEffect(() => {
    fetch("/api/og-settings")
      .then((r) => r.json())
      .then((data) => setSettings({ coverPages: 1, defaultLang: "fr", ...data }))
      .catch(console.error);
  }, []);

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center py-12">Chargement...</div>
      </div>
    );
  }

  function update(key: keyof OGSettings, value: string) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/og-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const isArabic = lang === "ar";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Paramètres des images OG
        </h1>
        <p className="text-gray-500 mb-8">
          Personnalisez le texte affiché sur les images partagées (réseaux sociaux, messagerie, etc.)
          Ces réglages sont globaux — chaque catalogue peut les surcharger depuis sa page détail (section « Image OG »).
        </p>

        {/* Language toggle */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setLang("fr")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              lang === "fr"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Français
          </button>
          <button
            onClick={() => setLang("ar")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              lang === "ar"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            العربية
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isArabic ? "النص العربي" : "Texte français"}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? "العنوان الرئيسي (البانر)" : "Titre du bandeau"}
              </label>
              <input
                type="text"
                value={isArabic ? settings.bannerTitleAr : settings.bannerTitle}
                onChange={(e) =>
                  update(isArabic ? "bannerTitleAr" : "bannerTitle", e.target.value)
                }
                dir={isArabic ? "rtl" : "ltr"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                {isArabic ? "مثل: كتالوج مرجان" : "Ex: Catalogue Marjane"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? "العنوان الفرعي (البانر)" : "Sous-titre du bandeau"}
              </label>
              <input
                type="text"
                value={isArabic ? settings.bannerSubtitleAr : settings.bannerSubtitle}
                onChange={(e) =>
                  update(isArabic ? "bannerSubtitleAr" : "bannerSubtitle", e.target.value)
                }
                dir={isArabic ? "rtl" : "ltr"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                {isArabic ? "مثل: عروض وتوصيل" : "Ex: Promotions et Offres"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? "النص الرئيسي" : "Texte principal"}
              </label>
              <input
                type="text"
                value={isArabic ? settings.bodyTextAr : settings.bodyText}
                onChange={(e) =>
                  update(isArabic ? "bodyTextAr" : "bodyText", e.target.value)
                }
                dir={isArabic ? "rtl" : "ltr"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                {isArabic ? "مثل: عروض وتوصيل في المغرب" : "Ex: Promotions et Offres au Maroc"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? "عدد صفحات الغلاف في الخلفية" : "Pages de couverture en arrière-plan"}
              </label>
              <select
                value={settings.coverPages}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, coverPages: parseInt(e.target.value, 10) } : prev
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>{isArabic ? "صفحة واحدة" : "1 page"}</option>
                <option value={2}>{isArabic ? "صفحتان جنبًا إلى جنب" : "2 pages côte à côte"}</option>
                <option value={3}>{isArabic ? "3 صفحات جنبًا إلى جنب" : "3 pages côte à côte"}</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {isArabic
                  ? "تُستخدم الصفحات الأولى من الكتالوج كخلفية لصورة المشاركة"
                  : "Les premières pages du catalogue sont assemblées en arrière-plan de l'image de partage"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isArabic ? "لغة صور المشاركة (افتراضي)" : "Langue des images OG (défaut)"}
              </label>
              <select
                value={settings.defaultLang}
                onChange={(e) =>
                  setSettings((prev) =>
                    prev ? { ...prev, defaultLang: e.target.value as "fr" | "ar" } : prev
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {isArabic
                  ? "تُستخدم عند مشاركة الروابط، ما لم يحدد الكتالوج لغة أخرى"
                  : "Utilisée pour les liens partagés, sauf si un catalogue choisit une autre langue"}
              </p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aperçu</h2>
          <div className="rounded-xl overflow-hidden border border-gray-200" style={{ aspectRatio: "1200/630" }}>
            <div className="w-full h-full flex flex-col">
              <div
                className="flex flex-col items-center justify-center py-4 px-6"
                style={{ background: "linear-gradient(90deg, #dc2626, #ef4444)" }}
              >
                <div
                  className={`text-xl md:text-2xl font-black leading-tight ${
                    isArabic ? "text-yellow-300" : "text-yellow-400"
                  }`}
                  style={{
                    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                    direction: isArabic ? "rtl" : "ltr",
                  }}
                >
                  {isArabic ? settings.bannerTitleAr : settings.bannerTitle}
                </div>
                <div
                  className="text-sm md:text-base font-bold text-white mt-1"
                  style={{
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                    direction: isArabic ? "rtl" : "ltr",
                  }}
                >
                  {isArabic
                    ? `من ${settings.bannerSubtitleAr}`
                    : `du ${settings.bannerSubtitle}`}
                </div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-blue-800 via-blue-600 to-blue-500 flex items-center justify-center">
                <div
                  className="text-white text-lg font-semibold opacity-90"
                  style={{ direction: isArabic ? "rtl" : "ltr" }}
                >
                  {isArabic ? settings.bodyTextAr : settings.bodyText}
                </div>
              </div>
              <div className="h-2 bg-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isArabic ? "ال ogl_actuel sera en arabe" : "L&apos;image OG utilisera ce texte"}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          {saved && (
            <span className="text-green-600 text-sm font-medium">
              Enregistré avec succès
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
