"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface Catalogue {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  paused: boolean;
  startDate: string;
  endDate: string;
  pageCount: number;
  processedPages: number;
  productCount: number;
  offerCount: number;
  articleCount: number;
  aiProcessingProgress: number;
  createdAt: string;
}

interface CataloguePage {
  pageNumber: number;
  status: string;
  pageType: string | null;
  productCount: number;
  confidence: number;
  aiModel: string | null;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;

export default function CataloguesPage() {
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pageProgress, setPageProgress] = useState<Record<string, CataloguePage[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    type: "weekly",
    startDate: "",
    endDate: "",
    description: "",
    sourceUrl: "",
    language: "fr",
  });
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    fetchCatalogues();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCatalogues();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCatalogues() {
    try {
      const res = await fetch("/api/catalogues");
      const data = await res.json();
      setCatalogues(data);
    } catch (err) {
      console.error("Failed to fetch catalogues:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPageProgress(catalogueId: string) {
    try {
      const res = await fetch(`/api/catalogues/${catalogueId}/pages`);
      if (res.ok) {
        const data = await res.json();
        setPageProgress((prev) => ({ ...prev, [catalogueId]: data }));
      }
    } catch (err) {
      console.error("Failed to fetch page progress:", err);
    }
  }

  function startPolling(catalogueId: string) {
    if (pollIntervals.current[catalogueId]) return;
    pollIntervals.current[catalogueId] = setInterval(() => {
      fetchPageProgress(catalogueId);
      fetchCatalogues();
    }, 3000);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.append("pdf", file);
    Object.entries(formData).forEach(([key, value]) => {
      fd.append(key, value);
    });

    try {
      const res = await fetch("/api/catalogues", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        addToast(err.error || "Upload failed", "error");
        return;
      }
      addToast("Catalogue uploaded successfully", "success");
      setFormData({ title: "", type: "weekly", startDate: "", endDate: "", description: "", sourceUrl: "", language: "fr" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchCatalogues();
    } catch (err) {
      console.error("Upload error:", err);
      addToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleAction(id: string, action: string) {
    if (processing[id]) return;
    setProcessing((prev) => ({ ...prev, [id]: true }));

    const labels: Record<string, string> = {
      extract: "Extracting pages",
      analyze: "Starting AI analysis",
      generate: "Generating article",
    };
    addToast(labels[action] || "Processing...", "info");

    const endpoints: Record<string, string> = {
      extract: `/api/catalogues/${id}/control`,
      analyze: `/api/catalogues/${id}/control`,
      generate: `/api/catalogues/${id}/generate-article`,
    };

    const bodies: Record<string, string> = {
      extract: JSON.stringify({ action: "start" }),
      analyze: JSON.stringify({ action: "start" }),
    };

    try {
      const res = await fetch(endpoints[action], {
        method: "POST",
        headers: bodies[action] ? { "Content-Type": "application/json" } : undefined,
        body: bodies[action],
      });
      if (res.ok) {
        fetchCatalogues();
        if (action === "analyze") startPolling(id);
        addToast(`${labels[action]} started`, "success");
      } else {
        const err = await res.json();
        addToast(err.error || "Action failed", "error");
      }
    } catch (err) {
      console.error("Process error:", err);
      addToast("Action failed", "error");
    } finally {
      setProcessing((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleControl(id: string, action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    if (processing[id]) return;
    setProcessing((prev) => ({ ...prev, [id]: true }));

    const labels: Record<string, string> = {
      pause: "Pausing",
      resume: "Resuming",
      restart: "Restarting",
      cancel: "Cancelling",
      remove: "Removing",
      reset: "Resetting",
    };
    addToast(`${labels[action]}...`, "info");

    try {
      const res = await fetch(`/api/catalogues/${id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchCatalogues();
        addToast(`${labels[action]} complete`, "success");
      } else {
        const err = await res.json();
        addToast(err.error || "Action failed", "error");
      }
    } catch (err) {
      console.error("Control error:", err);
      addToast("Action failed", "error");
    } finally {
      setProcessing((prev) => ({ ...prev, [id]: false }));
    }
  }

  function getStatusColor(status: string, paused: boolean) {
    if (paused) return "bg-amber-100 text-amber-800";
    const colors: Record<string, string> = {
      UPLOADED: "bg-gray-100 text-gray-800",
      PROCESSING: "bg-blue-100 text-blue-800",
      EXTRACTING: "bg-blue-100 text-blue-800",
      ANALYZING: "bg-purple-100 text-purple-800",
      STRUCTURING: "bg-indigo-100 text-indigo-800",
      GENERATING: "bg-yellow-100 text-yellow-800",
      REVIEW: "bg-orange-100 text-orange-800",
      PUBLISHED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
      ARCHIVED: "bg-gray-100 text-gray-500",
      CANCELLED: "bg-gray-200 text-gray-600",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  }

  function getStatusLabel(status: string, paused: boolean) {
    if (paused) return "PAUSED";
    return status;
  }

  function getPageStatusColor(status: string) {
    const colors: Record<string, string> = {
      PENDING: "bg-gray-100 text-gray-600",
      PROCESSING: "bg-yellow-100 text-yellow-800 animate-pulse",
      COMPLETED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-600";
  }

  function ActionButton({
    onClick,
    color,
    children,
    disabled,
    loading,
  }: {
    onClick: () => void;
    color: string;
    children: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
  }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${color}`}
      >
        {loading && (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }

  function renderActions(c: Catalogue) {
    const busy = processing[c.id];
    const isRunning = ["PROCESSING", "EXTRACTING", "ANALYZING", "GENERATING"].includes(c.status);
    const isDone = ["REVIEW", "PUBLISHED"].includes(c.status);
    const isFailed = c.status === "FAILED";
    const isIdle = c.status === "UPLOADED" || c.status === "CANCELLED";

    return (
      <>
        {isIdle && (
          <ActionButton onClick={() => handleAction(c.id, "extract")} color="bg-blue-600 text-white hover:bg-blue-700" loading={busy}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
            Start
          </ActionButton>
        )}

        {isDone && (
          <ActionButton onClick={() => handleAction(c.id, "generate")} color="bg-indigo-600 text-white hover:bg-indigo-700" loading={busy}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            Generate
          </ActionButton>
        )}

        {isRunning && !c.paused && (
          <ActionButton onClick={() => handleControl(c.id, "pause")} color="bg-amber-500 text-white hover:bg-amber-600" loading={busy}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
            Pause
          </ActionButton>
        )}

        {isRunning && c.paused && (
          <ActionButton onClick={() => handleControl(c.id, "resume")} color="bg-green-600 text-white hover:bg-green-700" loading={busy}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
            Resume
          </ActionButton>
        )}

        {isFailed && (
          <ActionButton onClick={() => handleControl(c.id, "resume")} color="bg-blue-600 text-white hover:bg-blue-700" loading={busy}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
            Resume
          </ActionButton>
        )}

        {(isDone || isRunning || isFailed) && (
          <ActionButton onClick={() => handleControl(c.id, "reset", "Reset AI analysis but keep extracted pages?")} color="bg-gray-200 text-gray-700 hover:bg-gray-300" loading={busy}>
            Reset AI
          </ActionButton>
        )}

        <ActionButton onClick={() => handleControl(c.id, "remove", "Delete this catalogue and all its data permanently?")} color="bg-red-100 text-red-700 hover:bg-red-200" loading={busy}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          Remove
        </ActionButton>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
                t.type === "success" ? "bg-green-600 text-white" :
                t.type === "error" ? "bg-red-600 text-white" :
                "bg-blue-600 text-white"
              }`}
            >
              {t.type === "success" && <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
              {t.type === "error" && <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
              {t.type === "info" && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {t.message}
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Catalogues</h1>
          <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload New Catalogue</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" required value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Catalogue Marjane" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="rentree">Rentrée</option>
                  <option value="ramadan">Ramadan</option>
                  <option value="eid">Eid</option>
                  <option value="technology">Technology</option>
                  <option value="home">Home</option>
                  <option value="food">Food</option>
                  <option value="supermarket">Supermarket</option>
                  <option value="special_promotion">Special Promotion</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input type="date" required value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input type="date" required value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF File *</label>
                <input type="file" accept=".pdf" required ref={fileInputRef}
                  className="w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
                <input type="url" value={formData.sourceUrl}
                  onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2" rows={2} />
            </div>
            <button type="submit" disabled={uploading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
              {uploading ? "Uploading..." : "Upload Catalogue"}
            </button>
          </form>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pages</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {catalogues.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className={`cursor-pointer transition-colors ${expandedId === c.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <td className="px-6 py-4">
                        <Link href={`/admin/catalogues/${c.id}`} onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:underline font-medium">{c.title}</Link>
                        <p className="text-sm text-gray-500">
                          {new Date(c.startDate).toLocaleDateString("fr-FR")} → {new Date(c.endDate).toLocaleDateString("fr-FR")}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(c.status, c.paused)}`}>
                          {getStatusLabel(c.status, c.paused)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{c.processedPages}/{c.pageCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{c.productCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{c.offerCount}</td>
                      <td className="px-6 py-4">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.round(c.aiProcessingProgress * 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(c.aiProcessingProgress * 100)}%</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {renderActions(c)}
                          <Link href={`/admin/catalogues/${c.id}`} onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr className="bg-blue-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            {pageProgress[c.id] && (
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 max-h-60 overflow-y-auto">
                                {pageProgress[c.id].map((p) => (
                                  <div key={p.pageNumber} className={`p-2 rounded border text-xs text-center ${getPageStatusColor(p.status)}`}>
                                    <div className="font-medium">P{p.pageNumber}</div>
                                    <div className="capitalize">{p.status}</div>
                                    {p.pageType && <div className="text-[10px] opacity-75">{p.pageType}</div>}
                                    {p.productCount > 0 && <div className="text-[10px] text-green-700">{p.productCount} products</div>}
                                    {p.confidence && <div className="text-[10px] opacity-75">{Math.round(p.confidence * 100)}%</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {!pageProgress[c.id] && (
                              <div className="text-center py-4 text-gray-500">Click to load page progress...</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}