"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface CataloguePage {
  id: string;
  pageNumber: number;
  status: string;
  pageType: string | null;
  category: string | null;
  productCount: number;
  confidence: number | null;
  aiModel: string | null;
  extractedText: string | null;
  imagePath: string | null;
  aiAnalysis: string | null;
}

interface ParsedAnalysis {
  pageNumber: number;
  pageType: string;
  category?: string | null;
  title?: string | null;
  products?: Array<{
    name: string;
    brand?: string | null;
    category?: string | null;
    originalPrice?: number | null;
    salePrice?: number | null;
    currency?: string;
    discountPercentage?: number | null;
    features?: string[];
  }>;
  confidence?: number;
}

interface CatalogueDetail {
  id: string;
  title: string;
  store: string;
  slug: string;
  type: string;
  status: string;
  description: string | null;
  sourceUrl: string | null;
  startDate: string;
  endDate: string;
  pageCount: number;
  processedPages: number;
  productCount: number;
  offerCount: number;
  articleCount: number;
  aiProcessingProgress: number;
  ogBannerTitle: string | null;
  ogBannerTitleAr: string | null;
  ogBannerSubtitle: string | null;
  ogBannerSubtitleAr: string | null;
  ogBodyText: string | null;
  ogBodyTextAr: string | null;
  ogCoverPages: number | null;
  ogLang: string | null;
}

const EMPTY_OG_FORM = {
  ogBannerTitle: "",
  ogBannerTitleAr: "",
  ogBannerSubtitle: "",
  ogBannerSubtitleAr: "",
  ogBodyText: "",
  ogBodyTextAr: "",
  // "" = inherit global, otherwise "1" | "2" | "3"
  ogCoverPages: "",
  // "" = inherit global, otherwise "fr" | "ar"
  ogLang: "",
};

export default function CatalogueDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [catalogue, setCatalogue] = useState<CatalogueDetail | null>(null);
  const [pages, setPages] = useState<CataloguePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<CataloguePage | null>(null);
  const [activeTab, setActiveTab] = useState<"image" | "text" | "analysis" | "products">("image");
  const [regenerating, setRegenerating] = useState(false);
  const [editorialSaving, setEditorialSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [pageProducts, setPageProducts] = useState<Array<{ id: string; name: string; imageUrl: string | null; boundingBox: { x: number; y: number; width: number; height: number } | null }>>([]);
  const [cropping, setCropping] = useState(false);
  const [imagePopup, setImagePopup] = useState<{ src: string; alt: string; boundingBox?: { x: number; y: number; width: number; height: number } | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", store: "marjane", description: "", type: "weekly", status: "UPLOADED", startDate: "", endDate: "", sourceUrl: "" });
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [ogForm, setOgForm] = useState(EMPTY_OG_FORM);
  const [ogGlobal, setOgGlobal] = useState<typeof EMPTY_OG_FORM | null>(null);
  const [ogGlobalCoverPages, setOgGlobalCoverPages] = useState(1);
  const [ogGlobalLang, setOgGlobalLang] = useState<"fr" | "ar">("fr");
  const [ogSaving, setOgSaving] = useState(false);
  const [ogOpen, setOgOpen] = useState(false);
  // Baseline snapshot at init: effective values + which keys were inherited (null).
  // Unchanged inherited fields are sent back as null so they keep inheriting the global.
  const [ogBaseline, setOgBaseline] = useState<{
    values: typeof EMPTY_OG_FORM;
    inherited: Record<string, boolean>;
  } | null>(null);
  const ogInitializedFor = React.useRef<string | null>(null);
  const toastTimer = React.useRef<NodeJS.Timeout | null>(null);

  const CATALOGUE_STATUSES = [
    "UPLOADED",
    "PROCESSING",
    "EXTRACTING",
    "ANALYZING",
    "STRUCTURING",
    "GENERATING",
    "REVIEW",
    "PUBLISHED",
    "FAILED",
    "ARCHIVED",
    "CANCELLED",
  ];

  function showToast(type: "success" | "error" | "info", message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    if (type !== "error") {
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/catalogues/${id}`).then((r) => r.json()),
      fetch(`/api/catalogues/${id}/pages`).then((r) => r.json()),
      fetch(`/api/og-settings`).then((r) => r.json()).catch(() => null),
    ])
      .then(([catalogueData, pagesData, ogSettings]) => {
        setCatalogue(catalogueData);
        setPages(pagesData);
        if (ogSettings) {
          setOgGlobal({
            ogBannerTitle: ogSettings.bannerTitle ?? "",
            ogBannerTitleAr: ogSettings.bannerTitleAr ?? "",
            ogBannerSubtitle: ogSettings.bannerSubtitle ?? "",
            ogBannerSubtitleAr: ogSettings.bannerSubtitleAr ?? "",
            ogBodyText: ogSettings.bodyText ?? "",
            ogBodyTextAr: ogSettings.bodyTextAr ?? "",
            ogCoverPages: "",
            ogLang: "",
          });
          const n = typeof ogSettings.coverPages === "number" ? ogSettings.coverPages : 1;
          setOgGlobalCoverPages(Number.isInteger(n) && n >= 1 && n <= 3 ? n : 1);
          setOgGlobalLang(ogSettings.defaultLang === "ar" ? "ar" : "fr");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [catalogueData, pagesData] = await Promise.all([
          fetch(`/api/catalogues/${id}`).then((r) => r.json()),
          fetch(`/api/catalogues/${id}/pages`).then((r) => r.json()),
        ]);
        setCatalogue(catalogueData);
        setPages(pagesData);
        setSelectedPage((prev) => {
          if (!prev) return null;
          const updated = pagesData.find((p: CataloguePage) => p.id === prev.id);
          return updated || prev;
        });
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  function parseAnalysis(raw: string | null): ParsedAnalysis | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function openEditModal() {
    if (!catalogue) return;
    setEditForm({
      title: catalogue.title,
      store: catalogue.store || "marjane",
      description: catalogue.description ?? "",
      type: catalogue.type,
      status: catalogue.status,
      startDate: catalogue.startDate.slice(0, 10),
      endDate: catalogue.endDate.slice(0, 10),
      sourceUrl: catalogue.sourceUrl ?? "",
    });
    setEditing(true);
  }

  async function handleGenerateEditorial() {
    if (editorialSaving) return;
    setEditorialSaving(true);
    showToast("info", "Mise en file d'attente de la génération…");
    try {
      const res = await fetch(`/api/catalogues/${id}/generate-editorial`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.jobId) {
        showToast("error", data.error || "Échec de mise en file d'attente");
        return;
      }
      showToast(
        "success",
        data.queued === false
          ? "Génération déjà en cours — suivi du job"
          : "Génération en file d'attente — le worker va la prendre en charge"
      );
      const job = await pollPageJob(data.jobId, "Texte éditorial");
      if (job?.status === "COMPLETED") {
        const updated = await fetch(`/api/catalogues/${id}`).then((r) => r.json());
        setCatalogue((prev) => (prev ? { ...prev, description: updated.description ?? prev.description } : prev));
        showToast("success", "Texte éditorial généré et vérifié");
      } else if (job?.status === "FAILED") {
        showToast("error", job.error || "Échec de génération (texte non vérifié)");
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setEditorialSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/catalogues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCatalogue((prev) => prev ? { ...prev, ...updated } : prev);
        showToast("success", `Status changed to ${status}`);
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", err.error || "Failed to change status");
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          store: editForm.store,
          type: editForm.type,
          status: editForm.status,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          sourceUrl: editForm.sourceUrl || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCatalogue((prev) => prev ? { ...prev, ...updated } : prev);
        setEditing(false);
        showToast("success", "Catalogue updated");
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", err.error || "Failed to save");
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOg() {
    setOgSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      const baseline = ogBaseline;
      (Object.keys(EMPTY_OG_FORM) as Array<keyof typeof EMPTY_OG_FORM>).forEach((k) => {
        // Field inherited at load and untouched since → keep inheriting (null),
        // so future global changes still propagate. Anything edited is saved as a copy.
        if (baseline?.inherited[k] && ogForm[k] === baseline.values[k]) {
          payload[k] = null;
          return;
        }
        const v = ogForm[k].trim();
        payload[k] = v === "" ? null : ogForm[k];
      });
      const res = await fetch(`/api/catalogues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setCatalogue((prev) => prev ? { ...prev, ...updated } : prev);
        // Re-baseline on saved effective values so a second save without edits is a no-op
        const global = ogGlobal ?? EMPTY_OG_FORM;
        const effective = {
          ogBannerTitle: updated.ogBannerTitle ?? global.ogBannerTitle,
          ogBannerTitleAr: updated.ogBannerTitleAr ?? global.ogBannerTitleAr,
          ogBannerSubtitle: updated.ogBannerSubtitle ?? global.ogBannerSubtitle,
          ogBannerSubtitleAr: updated.ogBannerSubtitleAr ?? global.ogBannerSubtitleAr,
          ogBodyText: updated.ogBodyText ?? global.ogBodyText,
          ogBodyTextAr: updated.ogBodyTextAr ?? global.ogBodyTextAr,
          ogCoverPages: updated.ogCoverPages != null ? String(updated.ogCoverPages) : "",
          ogLang: updated.ogLang ?? "",
        };
        setOgForm(effective);
        setOgBaseline({
          values: effective,
          inherited: {
            ogBannerTitle: updated.ogBannerTitle == null,
            ogBannerTitleAr: updated.ogBannerTitleAr == null,
            ogBannerSubtitle: updated.ogBannerSubtitle == null,
            ogBannerSubtitleAr: updated.ogBannerSubtitleAr == null,
            ogBodyText: updated.ogBodyText == null,
            ogBodyTextAr: updated.ogBodyTextAr == null,
            ogCoverPages: updated.ogCoverPages == null,
            ogLang: updated.ogLang == null,
          },
        });
        showToast("success", "OG overrides saved");
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", err.error || "Failed to save OG overrides");
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setOgSaving(false);
    }
  }

  async function handleResetOg() {
    if (!window.confirm("Effacer les surcharges OG de ce catalogue et réutiliser le réglage global ?")) return;
    setOgSaving(true);
    try {
      const res = await fetch(`/api/catalogues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogBannerTitle: null,
          ogBannerTitleAr: null,
          ogBannerSubtitle: null,
          ogBannerSubtitleAr: null,
          ogBodyText: null,
          ogBodyTextAr: null,
          ogCoverPages: null,
          ogLang: null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCatalogue((prev) => prev ? { ...prev, ...updated } : prev);
        const global = ogGlobal ?? EMPTY_OG_FORM;
        const effective = {
          ogBannerTitle: global.ogBannerTitle,
          ogBannerTitleAr: global.ogBannerTitleAr,
          ogBannerSubtitle: global.ogBannerSubtitle,
          ogBannerSubtitleAr: global.ogBannerSubtitleAr,
          ogBodyText: global.ogBodyText,
          ogBodyTextAr: global.ogBodyTextAr,
          ogCoverPages: "",
          ogLang: "",
        };
        setOgForm(effective);
        setOgBaseline({
          values: effective,
          inherited: {
            ogBannerTitle: true,
            ogBannerTitleAr: true,
            ogBannerSubtitle: true,
            ogBannerSubtitleAr: true,
            ogBodyText: true,
            ogBodyTextAr: true,
            ogCoverPages: true,
            ogLang: true,
          },
        });
        showToast("success", "OG overrides cleared — using global settings");
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", err.error || "Failed to reset OG overrides");
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setOgSaving(false);
    }
  }

  function ogInheritedBadge(key: keyof typeof EMPTY_OG_FORM) {
    const baseline = ogBaseline;
    if (baseline?.inherited[key] && ogForm[key] === baseline.values[key]) {
      return (
        <span className="ml-2 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
          global
        </span>
      );
    }
    return null;
  }

  function closeOgModal() {
    // Discard unsaved edits — restore last saved/initial values
    if (ogBaseline) setOgForm({ ...ogBaseline.values });
    setOgOpen(false);
  }

  function ogOverrideCount(): number {
    if (!catalogue) return 0;
    return [
      catalogue.ogBannerTitle,
      catalogue.ogBannerTitleAr,
      catalogue.ogBannerSubtitle,
      catalogue.ogBannerSubtitleAr,
      catalogue.ogBodyText,
      catalogue.ogBodyTextAr,
      catalogue.ogCoverPages,
      catalogue.ogLang,
    ].filter((v) => v != null).length;
  }

  // Init OG form once per catalogue, pre-filled with effective values  // (override ?? global). Polling refreshes `catalogue` every 2s — don't clobber typing.
  useEffect(() => {
    if (catalogue && ogGlobal && ogInitializedFor.current !== catalogue.id) {
      ogInitializedFor.current = catalogue.id;
      const effective = {
        ogBannerTitle: catalogue.ogBannerTitle ?? ogGlobal.ogBannerTitle,
        ogBannerTitleAr: catalogue.ogBannerTitleAr ?? ogGlobal.ogBannerTitleAr,
        ogBannerSubtitle: catalogue.ogBannerSubtitle ?? ogGlobal.ogBannerSubtitle,
        ogBannerSubtitleAr: catalogue.ogBannerSubtitleAr ?? ogGlobal.ogBannerSubtitleAr,
        ogBodyText: catalogue.ogBodyText ?? ogGlobal.ogBodyText,
        ogBodyTextAr: catalogue.ogBodyTextAr ?? ogGlobal.ogBodyTextAr,
        ogCoverPages: catalogue.ogCoverPages != null ? String(catalogue.ogCoverPages) : "",
        ogLang: catalogue.ogLang ?? "",
      };
      setOgForm(effective);
      setOgBaseline({
        values: effective,
        inherited: {
          ogBannerTitle: catalogue.ogBannerTitle == null,
          ogBannerTitleAr: catalogue.ogBannerTitleAr == null,
          ogBannerSubtitle: catalogue.ogBannerSubtitle == null,
          ogBannerSubtitleAr: catalogue.ogBannerSubtitleAr == null,
          ogBodyText: catalogue.ogBodyText == null,
          ogBodyTextAr: catalogue.ogBodyTextAr == null,
          ogCoverPages: catalogue.ogCoverPages == null,
          ogLang: catalogue.ogLang == null,
        },
      });
    }
  }, [catalogue, ogGlobal]);

  function toImageUrl(imagePath: string | null): string | null {
    if (!imagePath) return null;
    const uploadsIdx = imagePath.indexOf("uploads/");
    if (uploadsIdx !== -1) {
      return "/" + imagePath.slice(uploadsIdx);
    }
    return imagePath;
  }

  function BoundingBoxCrop({ pageImageUrl, boundingBox, alt, className }: {
    pageImageUrl: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    alt: string;
    className?: string;
  }) {
    const [loaded, setLoaded] = React.useState(false);
    const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);

    React.useEffect(() => {
      const img = new Image();
      img.onload = () => { setDims({ w: img.naturalWidth, h: img.naturalHeight }); setLoaded(true); };
      img.src = pageImageUrl;
    }, [pageImageUrl]);

    if (!loaded || !dims) {
      return <div className={`bg-gray-200 animate-pulse rounded ${className || "w-16 h-16"}`} />;
    }

    const px = boundingBox.x * dims.w;
    const py = boundingBox.y * dims.h;
    const pw = boundingBox.width * dims.w;
    const ph = boundingBox.height * dims.h;
    const scale = Math.max(64 / pw, 64 / ph);

    return (
      <div
        className={`overflow-hidden rounded bg-white border shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition ${className || "w-16 h-16"}`}
        onClick={() => setImagePopup({ src: pageImageUrl, alt, boundingBox })}
      >
        <img
          src={pageImageUrl}
          alt={alt}
          style={{
            width: dims.w * scale,
            height: dims.h * scale,
            objectFit: "cover",
            marginLeft: -(px * scale),
            marginTop: -(py * scale),
          }}
        />
      </div>
    );
  }

  function PopupCrop({ src, boundingBox, alt }: {
    src: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    alt: string;
  }) {
    const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);

    React.useEffect(() => {
      const img = new Image();
      img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = src;
    }, [src]);

    if (!dims) {
      return <div className="w-96 h-96 bg-gray-800 animate-pulse rounded-lg" />;
    }

    const pw = boundingBox.width * dims.w;
    const ph = boundingBox.height * dims.h;
    const maxW = Math.min(window.innerWidth * 0.7, 800);
    const maxH = window.innerHeight * 0.75;
    const scale = Math.min(maxW / pw, maxH / ph, 4);

    return (
      <div
        className="overflow-hidden rounded-lg shadow-2xl"
        style={{ width: pw * scale, height: ph * scale }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: dims.w * scale,
            height: dims.h * scale,
            objectFit: "cover",
            marginLeft: -(boundingBox.x * dims.w * scale),
            marginTop: -(boundingBox.y * dims.h * scale),
          }}
        />
      </div>
    );
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      PENDING: "bg-gray-100 text-gray-600",
      PROCESSING: "bg-yellow-100 text-yellow-800 animate-pulse",
      COMPLETED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-600";
  }

  /** Poll an ANALYZE_PAGE job to completion; returns the terminal job payload or null. */
  async function pollPageJob(jobId: string, label: string): Promise<{
    status: string;
    error?: string | null;
    result?: { products?: number; confidence?: number | null; cropped?: number } | null;
  } | null> {
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) continue;
        const job = await res.json();
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          // Page content changed under a public URL — refresh it now.
          if (job.status === "COMPLETED" && catalogue) {
            try {
              await fetch("/api/revalidate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "catalogue", slug: catalogue.slug }),
              });
            } catch (err) {
              console.error("Revalidate error:", err);
            }
          }
          return job;
        }
      } catch (err) {
        console.error("Job poll error:", err);
      }
    }
    showToast("info", `${label} is still running in the background`);
    return null;
  }

  async function refreshPages() {
    const pagesRes = await fetch(`/api/catalogues/${id}/pages`);
    if (pagesRes.ok) {
      const pagesData = await pagesRes.json();
      setPages(pagesData);
      setSelectedPage((prev) => {
        if (!prev) return null;
        return pagesData.find((p: CataloguePage) => p.id === prev.id) || prev;
      });
    }
  }

  async function handleRegenerate() {
    if (!selectedPage || regenerating) return;
    setRegenerating(true);
    showToast("info", `Queueing analysis for page ${selectedPage.pageNumber}...`);
    const pageNumber = selectedPage.pageNumber;
    try {
      const res = await fetch(`/api/pages/${selectedPage.id}/analyze`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data?.jobId) {
          showToast(
            "success",
            data.queued === false ? "Analysis already running — watching it" : "Analysis queued — worker will pick it up"
          );
          const job = await pollPageJob(data.jobId, "Page analysis");
          if (job?.status === "COMPLETED") {
            await refreshPages();
            const products = job.result?.products ?? 0;
            const confidence = job.result?.confidence ?? 0;
            showToast("success", `Page ${pageNumber} regenerated — ${products} products, ${Math.round(confidence * 100)}% confidence`);
          } else if (job?.status === "FAILED") {
            showToast("error", `Failed: ${job.error || "unknown error"}`);
          }
        } else {
          // Legacy sync response shape (?sync=true)
          setSelectedPage((prev) => prev ? {
            ...prev,
            aiAnalysis: null,
            productCount: data.products,
            confidence: data.confidence,
            status: "COMPLETED",
          } : prev);
          await refreshPages();
          showToast("success", `Page ${pageNumber} regenerated — ${data.products} products, ${Math.round((data.confidence || 0) * 100)}% confidence`);
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", `Failed: ${err.error}`);
      }
    } catch {
      showToast("error", "Network error — is the server running?");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCropImages() {
    if (!selectedPage || cropping) return;
    setCropping(true);
    showToast("info", "Queueing product image cropping...");
    try {
      const res = await fetch(`/api/catalogues/${id}/pages/${selectedPage.id}/crop`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data?.jobId) {
          showToast(
            "success",
            data.queued === false ? "Crop job already running — watching it" : "Cropping queued — worker will pick it up"
          );
          const job = await pollPageJob(data.jobId, "Cropping");
          if (job?.status === "COMPLETED") {
            showToast("success", `Cropped ${job.result?.cropped ?? 0} product images`);
            const productsRes = await fetch(`/api/catalogues/${id}/pages/${selectedPage.id}/products`);
            if (productsRes.ok) setPageProducts(await productsRes.json());
          } else if (job?.status === "FAILED") {
            showToast("error", `Failed: ${job.error || "unknown error"}`);
          }
        } else {
          // Legacy sync response shape (?sync=true)
          showToast("success", `Cropped ${data.cropped} product images`);
          const productsRes = await fetch(`/api/catalogues/${id}/pages/${selectedPage.id}/products`);
          if (productsRes.ok) setPageProducts(await productsRes.json());
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", `Failed: ${err.error}`);
      }
    } catch {
      showToast("error", "Network error");
    } finally {
      setCropping(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!catalogue) return <div className="p-8 text-center">Catalogue not found</div>;

  const selectedAnalysis = parseAnalysis(selectedPage?.aiAnalysis ?? null);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/admin/catalogues" className="text-blue-600 hover:underline mb-4 block">
          ← Back to Catalogues
        </Link>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{catalogue.title}</h1>
                <button
                  onClick={openEditModal}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit catalogue"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                </button>
                <button
                  onClick={() => setOgOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-full px-2.5 py-1 transition-colors"
                  title="Personnaliser l'image OG de ce catalogue"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                  Image OG
                  {ogOverrideCount() > 0 ? (
                    <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-px">
                      {ogOverrideCount()}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">global</span>
                  )}
                </button>
              </div>
              <p className="text-gray-600 mt-1">
                {catalogue.store === "marjane_market" ? "Marjane Market" : "Marjane"} — {" "}
                {new Date(catalogue.startDate).toLocaleDateString("fr-FR")} →{" "}
                {new Date(catalogue.endDate).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                {catalogue.status}
              </span>
              <select
                value={catalogue.status}
                disabled={statusSaving}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                title="Change status"
              >
                {CATALOGUE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{catalogue.pageCount}</p>
              <p className="text-sm text-gray-500">Pages</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{catalogue.processedPages}</p>
              <p className="text-sm text-gray-500">Processed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{catalogue.productCount}</p>
              <p className="text-sm text-gray-500">Products</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{catalogue.offerCount}</p>
              <p className="text-sm text-gray-500">Offers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(catalogue.aiProcessingProgress * 100)}%
              </p>
              <p className="text-sm text-gray-500">AI Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Texte éditorial (SEO)</h2>
              <p className="text-sm text-gray-500">
                Généré par IA via la file d&apos;attente du worker, à partir des offres en base, vérifié prix par prix. Affiché sur la page publique.
              </p>
            </div>
            <button
              onClick={handleGenerateEditorial}
              disabled={editorialSaving}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {editorialSaving ? "Génération…" : catalogue.description ? "Régénérer" : "Générer"}
            </button>
          </div>
          {catalogue.description ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{catalogue.description}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Aucun texte — la page publique affiche un résumé automatique.</p>
          )}
        </div>

        {ogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeOgModal}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Image OG — surcharge catalogue</h2>
            <div className="flex items-center gap-2 text-xs">
              <a
                href={`/api/og?type=catalogue&slug=${catalogue.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
                title="Rendu avec la langue effective (catalogue puis global)"
              >
                Aperçu
              </a>
              <span className="text-gray-300">|</span>
              <a
                href={`/api/og?type=catalogue&slug=${catalogue.slug}&lang=fr`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                FR
              </a>
              <span className="text-gray-300">|</span>
              <a
                href={`/api/og?type=catalogue&slug=${catalogue.slug}&lang=ar`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                AR
              </a>
              <span className="text-gray-300">|</span>
              <button
                onClick={closeOgModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-1"
                title="Fermer"
              >
                ×
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Pré-rempli avec le réglage global — modifiez un champ pour surcharger ce catalogue.
            Videz un champ ou utilisez « Réinitialiser » pour ré-hériter du global (<a href="/admin/settings" className="text-blue-600 hover:underline">Paramètres des images OG</a>).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre du bandeau (FR){ogInheritedBadge("ogBannerTitle")}</label>
              <input
                type="text"
                value={ogForm.ogBannerTitle}
                onChange={(e) => setOgForm((f) => ({ ...f, ogBannerTitle: e.target.value }))}
                placeholder="Hérite du global"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre du bandeau (AR){ogInheritedBadge("ogBannerTitleAr")}</label>
              <input
                type="text"
                dir="rtl"
                value={ogForm.ogBannerTitleAr}
                onChange={(e) => setOgForm((f) => ({ ...f, ogBannerTitleAr: e.target.value }))}
                placeholder="Hérite du global"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre du bandeau (FR){ogInheritedBadge("ogBannerSubtitle")}</label>
              <input
                type="text"
                value={ogForm.ogBannerSubtitle}
                onChange={(e) => setOgForm((f) => ({ ...f, ogBannerSubtitle: e.target.value }))}
                placeholder="Hérite du global"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre du bandeau (AR){ogInheritedBadge("ogBannerSubtitleAr")}</label>
              <input
                type="text"
                dir="rtl"
                value={ogForm.ogBannerSubtitleAr}
                onChange={(e) => setOgForm((f) => ({ ...f, ogBannerSubtitleAr: e.target.value }))}
                placeholder="Hérite du global"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texte principal (FR){ogInheritedBadge("ogBodyText")}</label>
              <input
                type="text"
                value={ogForm.ogBodyText}
                onChange={(e) => setOgForm((f) => ({ ...f, ogBodyText: e.target.value }))}
                placeholder="Hérite du global"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texte principal (AR){ogInheritedBadge("ogBodyTextAr")}</label>
              <input
                type="text"
                dir="rtl"
                value={ogForm.ogBodyTextAr}
                onChange={(e) => setOgForm((f) => ({ ...f, ogBodyTextAr: e.target.value }))}
                placeholder="Hérite du global"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pages en arrière-plan{ogInheritedBadge("ogCoverPages")}</label>
              <select
                value={ogForm.ogCoverPages}
                onChange={(e) => setOgForm((f) => ({ ...f, ogCoverPages: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Hériter du global ({ogGlobalCoverPages} page{ogGlobalCoverPages > 1 ? "s" : ""})</option>
                <option value="1">1 page (couverture)</option>
                <option value="2">2 premières pages côte à côte</option>
                <option value="3">3 premières pages côte à côte</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Les premières pages du catalogue sont assemblées en arrière-plan de l&apos;image de partage.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Langue de l&apos;image OG{ogInheritedBadge("ogLang")}</label>
              <select
                value={ogForm.ogLang}
                onChange={(e) => setOgForm((f) => ({ ...f, ogLang: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Hériter du global ({ogGlobalLang === "ar" ? "العربية" : "Français"})</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Langue du bandeau et du texte sur l&apos;image partagée par les réseaux sociaux.</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleSaveOg}
              disabled={ogSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {ogSaving ? "Enregistrement..." : "Enregistrer la surcharge OG"}
            </button>
            <button
              onClick={handleResetOg}
              disabled={ogSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Réinitialiser (global)
            </button>
          </div>
          </div>
        </div>
        )}

        <h2 className="text-xl font-semibold text-gray-900 mb-4">Pages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              onClick={() => {
                setSelectedPage(page);
                setActiveTab("image");
                fetch(`/api/catalogues/${id}/pages/${page.id}/products`)
                  .then((r) => r.json())
                  .then((data) => setPageProducts(Array.isArray(data) ? data : []))
                  .catch(() => setPageProducts([]));
              }}
              className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">Page {page.pageNumber}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(page.status)}`}>
                  {page.status}
                </span>
              </div>
              {page.imagePath && (
                <img
                  src={toImageUrl(page.imagePath) || ""}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-32 object-cover rounded mb-2"
                />
              )}
              {page.pageType && (
                <p className="text-sm text-gray-600">Type: {page.pageType}</p>
              )}
              {page.category && (
                <p className="text-sm text-gray-600">Category: {page.category}</p>
              )}
              <p className="text-sm text-gray-600">Products: {page.productCount}</p>
              {page.confidence !== null && (
                <p className="text-sm text-gray-600">
                  Confidence: {Math.round(page.confidence * 100)}%
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedPage(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                Page {selectedPage.pageNumber}
                <span className={`ml-3 text-xs px-2 py-1 rounded-full ${getStatusColor(selectedPage.status)}`}>
                  {selectedPage.status}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {regenerating ? (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                  )}
                  {regenerating ? "Analyzing..." : "Regenerate AI"}
                </button>
                <button
                  onClick={handleCropImages}
                  disabled={cropping || regenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {cropping ? (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-6L16.5 19m0 0L12 14.5m4.5 4.5V7.5" /></svg>
                  )}
                  {cropping ? "Cropping..." : "Crop Images"}
                </button>
                <button
                  onClick={() => setSelectedPage(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 border-r bg-gray-100 flex items-center justify-center overflow-auto p-4">
                {selectedPage.imagePath ? (
                  <img
                    src={toImageUrl(selectedPage.imagePath) || ""}
                    alt={`Page ${selectedPage.pageNumber}`}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow"
                  />
                ) : (
                  <p className="text-gray-500">No image available</p>
                )}
              </div>

              <div className="w-1/2 flex flex-col overflow-hidden">
                <div className="flex border-b px-4 shrink-0">
                  {(["text", "analysis", "products"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab === "text" && "Extracted Text"}
                      {tab === "analysis" && "AI Analysis"}
                      {tab === "products" && `Products (${selectedAnalysis?.products?.length || 0})`}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-auto p-4">
                  {activeTab === "text" && (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {selectedPage.extractedText
                            ? `${selectedPage.extractedText.length} characters`
                            : "No text extracted"}
                        </span>
                        {selectedPage.extractedText && (
                          <button
                            onClick={() => navigator.clipboard.writeText(selectedPage.extractedText!)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Copy text
                          </button>
                        )}
                      </div>
                      <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-[65vh] overflow-auto">
                        {selectedPage.extractedText || "No text extracted from this page."}
                      </pre>
                    </div>
                  )}

                  {activeTab === "analysis" && (
                    <div>
                      {selectedAnalysis ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Page Type</p>
                              <p className="font-medium text-gray-900">{selectedAnalysis.pageType}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Category</p>
                              <p className="font-medium text-gray-900">{selectedAnalysis.category || "N/A"}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">Confidence</p>
                              <p className="font-medium text-gray-900">
                                {selectedPage.confidence ? `${Math.round(selectedPage.confidence * 100)}%` : "N/A"}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs text-gray-500">AI Model</p>
                              <p className="font-medium text-gray-900">{selectedPage.aiModel || "N/A"}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Full JSON</p>
                            <pre className="bg-gray-50 rounded-lg p-4 text-xs text-gray-800 whitespace-pre-wrap overflow-auto max-h-[50vh]">
                              {JSON.stringify(selectedAnalysis, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500">No AI analysis available for this page.</p>
                      )}
                    </div>
                  )}

                  {activeTab === "products" && (
                    <div>
                      {selectedAnalysis?.products && selectedAnalysis.products.length > 0 ? (
                        <div className="space-y-3">
                          {selectedAnalysis.products.map((product, idx) => {
                            const dbProduct = pageProducts.find(
                              (p) => p.name.toLowerCase() === product.name.toLowerCase()
                            );
                            return (
                            <div key={idx} className="bg-gray-50 rounded-lg p-4 border">
                              <div className="flex items-start gap-3">
                                {dbProduct?.imageUrl && toImageUrl(dbProduct.imageUrl) ? (
                                  <img
                                    src={toImageUrl(dbProduct.imageUrl)!}
                                    alt={product.name}
                                    className="w-16 h-16 object-contain rounded bg-white border shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                                    onClick={() => setImagePopup({ src: toImageUrl(dbProduct.imageUrl)!, alt: product.name })}
                                  />
                                ) : dbProduct?.boundingBox && selectedPage?.imagePath && toImageUrl(selectedPage.imagePath) ? (
                                  <BoundingBoxCrop
                                    pageImageUrl={toImageUrl(selectedPage.imagePath)!}
                                    boundingBox={dbProduct.boundingBox}
                                    alt={product.name}
                                    className="w-16 h-16 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
                                  />
                                ) : null}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium text-gray-900">{product.name}</p>
                                      {product.brand && (
                                        <p className="text-sm text-gray-600">Brand: {product.brand}</p>
                                      )}
                                      {product.category && (
                                        <p className="text-sm text-gray-600">Category: {product.category}</p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0">
                                      {product.salePrice && (
                                        <p className="font-bold text-green-600">
                                          {product.salePrice} {product.currency || "MAD"}
                                        </p>
                                      )}
                                      {product.originalPrice && product.originalPrice !== product.salePrice && (
                                        <p className="text-sm text-gray-400 line-through">
                                          {product.originalPrice} {product.currency || "MAD"}
                                        </p>
                                      )}
                                      {product.discountPercentage && (
                                        <p className="text-xs text-red-600 font-medium">
                                          -{product.discountPercentage}%
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {product.features && product.features.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {product.features.map((f, fi) => (
                                        <span key={fi} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                          {f}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500">No products extracted from this page.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {imagePopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-8" onClick={() => setImagePopup(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImagePopup(null)}
              className="absolute -top-3 -right-3 text-white bg-gray-800 hover:bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg z-10"
            >
              ×
            </button>
            {imagePopup.boundingBox ? (
              <PopupCrop src={imagePopup.src} boundingBox={imagePopup.boundingBox} alt={imagePopup.alt} />
            ) : (
              <img
                src={imagePopup.src}
                alt={imagePopup.alt}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            )}
            <p className="text-white text-sm mt-3 text-center bg-black/50 px-3 py-1 rounded">{imagePopup.alt}</p>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-green-600 text-white" :
          toast.type === "error" ? "bg-red-600 text-white" :
          "bg-blue-600 text-white"
        }`}>
          {toast.type === "success" && (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          )}
          {toast.type === "error" && (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {toast.type === "info" && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          {toast.message}
          {toast.type === "error" && (
            <button onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Edit Catalogue</h3>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select
                  value={editForm.store}
                  onChange={(e) => setEditForm((f) => ({ ...f, store: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="marjane">Marjane</option>
                  <option value="marjane_market">Marjane Market</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                  <option value="seasonal">Saisonnier</option>
                  <option value="rentree">Rentrée Scolaire</option>
                  <option value="ramadan">Ramadan</option>
                  <option value="eid">Aid</option>
                  <option value="technology">High-Tech</option>
                  <option value="home">Maison</option>
                  <option value="food">Alimentation</option>
                  <option value="supermarket">Supermarché</option>
                  <option value="special_promotion">Promotion Spéciale</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATALOGUE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">PUBLISHED / REVIEW are visible on the site. ARCHIVED hides it.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
                <input
                  type="url"
                  value={editForm.sourceUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.title.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}