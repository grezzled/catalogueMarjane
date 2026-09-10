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
  startDate: string;
  endDate: string;
  pageCount: number;
  processedPages: number;
  productCount: number;
  offerCount: number;
  articleCount: number;
  aiProcessingProgress: number;
}

export default function CatalogueDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [catalogue, setCatalogue] = useState<CatalogueDetail | null>(null);
  const [pages, setPages] = useState<CataloguePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<CataloguePage | null>(null);
  const [activeTab, setActiveTab] = useState<"image" | "text" | "analysis" | "products">("image");
  const [regenerating, setRegenerating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [pageProducts, setPageProducts] = useState<Array<{ id: string; name: string; imageUrl: string | null; boundingBox: { x: number; y: number; width: number; height: number } | null }>>([]);
  const [cropping, setCropping] = useState(false);
  const [imagePopup, setImagePopup] = useState<{ src: string; alt: string; boundingBox?: { x: number; y: number; width: number; height: number } | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", store: "marjane", description: "", type: "weekly", startDate: "", endDate: "", sourceUrl: "" });
  const [saving, setSaving] = useState(false);
  const toastTimer = React.useRef<NodeJS.Timeout | null>(null);

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
    ])
      .then(([catalogueData, pagesData]) => {
        setCatalogue(catalogueData);
        setPages(pagesData);
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
      description: "",
      type: catalogue.type,
      startDate: catalogue.startDate.slice(0, 10),
      endDate: catalogue.endDate.slice(0, 10),
      sourceUrl: "",
    });
    setEditing(true);
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

  async function handleRegenerate() {
    if (!selectedPage || regenerating) return;
    setRegenerating(true);
    showToast("info", `Regenerating page ${selectedPage.pageNumber}...`);
    try {
      const res = await fetch(`/api/pages/${selectedPage.id}/analyze`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSelectedPage((prev) => prev ? {
          ...prev,
          aiAnalysis: null,
          productCount: data.products,
          confidence: data.confidence,
          status: "COMPLETED",
        } : prev);
        const pagesRes = await fetch(`/api/catalogues/${id}/pages`);
        if (pagesRes.ok) setPages(await pagesRes.json());
        showToast("success", `Page ${selectedPage.pageNumber} regenerated — ${data.products} products, ${Math.round((data.confidence || 0) * 100)}% confidence`);
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        showToast("error", `Failed: ${err.error}`);
      }
    } catch (err) {
      showToast("error", "Network error — is the server running?");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCropImages() {
    if (!selectedPage || cropping) return;
    setCropping(true);
    showToast("info", "Cropping product images...");
    try {
      const res = await fetch(`/api/catalogues/${id}/pages/${selectedPage.id}/crop`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast("success", `Cropped ${data.cropped} product images`);
        const productsRes = await fetch(`/api/catalogues/${id}/pages/${selectedPage.id}/products`);
        if (productsRes.ok) setPageProducts(await productsRes.json());
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
              </div>
              <p className="text-gray-600 mt-1">
                {catalogue.store === "marjane_market" ? "Marjane Market" : "Marjane"} — {" "}
                {new Date(catalogue.startDate).toLocaleDateString("fr-FR")} →{" "}
                {new Date(catalogue.endDate).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
              {catalogue.status}
            </span>
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