"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface Catalogue {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  store: string;
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pageProgress, setPageProgress] = useState<Record<string, CataloguePage[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    store: "marjane",
    type: "weekly",
    startDate: "",
    endDate: "",
    description: "",
    sourceUrl: "",
    language: "fr",
  });
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [jobLog, setJobLog] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", store: "marjane", type: "weekly", status: "UPLOADED", startDate: "", endDate: "", sourceUrl: "" });
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState<Record<string, boolean>>({});
  const pollIntervals = useRef<Record<string, NodeJS.Timeout>>({});

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
      setFormData({ title: "", store: "marjane", type: "weekly", startDate: "", endDate: "", description: "", sourceUrl: "", language: "fr" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadOpen(false);
      fetchCatalogues();
    } catch (err) {
      console.error("Upload error:", err);
      addToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function revalidate(scope: "site" | "catalogue" | "article", slug?: string) {
    try {
      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope !== "site" && slug ? { scope, slug } : { scope: "site" }
        ),
      });
    } catch (err) {
      console.error("Revalidate error:", err);
    }
  }

  async function pollJob(catalogueId: string, jobId: string, kind: "article" | "processing") {
    const maxAttempts = kind === "article" ? 200 : 400; // ~10 min / ~20 min at 3s intervals
    const label = kind === "article" ? "Article generation" : "Processing";
    const lastStep = (job: {
      status: string;
      retryCount?: number;
      error?: string | null;
      result?: { articleId?: string; logs?: Array<{ step: string; status: string; message: string }> } | null;
    }) => {
      const logs = job.result?.logs;
      if (logs && logs.length > 0) {
        const last = logs[logs.length - 1];
        setJobLog((prev) => ({
          ...prev,
          [catalogueId]: `[${last.status}] ${last.step}: ${last.message}`.slice(0, 160),
        }));
      } else {
        const phase =
          job.status === "PROCESSING" ? "processing" :
          job.status === "RETRYING" ? `retrying (${job.retryCount ?? 0})` :
          "queued";
        setJobLog((prev) => ({ ...prev, [catalogueId]: `Job ${phase}...` }));
      }
    };
    const clearJob = () => {
      setProcessing((prev) => ({ ...prev, [catalogueId]: false }));
      setJobLog((prev) => {
        const next = { ...prev };
        delete next[catalogueId];
        return next;
      });
    };
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) continue;
        const job = await res.json();
        lastStep(job);
        if (job.status === "COMPLETED") {
          if (kind === "article") {
            const articleId = job.result?.articleId;
            addToast(
              articleId ? `Article generated — ${articleId}` : "Article generated",
              "success"
            );
            // New articles land in APPROVED (not public) — nothing to revalidate.
          } else {
            const r = job.result ?? {};
            const bits = [
              r.processedPages != null ? `${r.processedPages} pages` : null,
              r.productCount != null ? `${r.productCount} products` : null,
              r.offerCount != null ? `${r.offerCount} offers` : null,
            ].filter(Boolean);
            addToast(
              bits.length > 0 ? `Processing complete — ${bits.join(", ")}` : "Processing complete",
              "success"
            );
            // Content changed under a public URL — refresh it now (ISR backstop: 600s).
            const slug = catalogues.find((c) => c.id === catalogueId)?.slug;
            revalidate("catalogue", slug);
          }
          fetchCatalogues();
          clearJob();
          return;
        }
        if (job.status === "FAILED") {
          addToast(
            `${label} failed${job.retryCount ? ` after ${job.retryCount} retries` : ""}: ${job.error || "unknown error"}`,
            "error"
          );
          fetchCatalogues();
          clearJob();
          return;
        }
        // PENDING / RETRYING / PROCESSING → keep polling
      } catch (err) {
        console.error("Job poll error:", err);
      }
    }
    addToast(`${label} is still running in the background`, "info");
    clearJob();
  }

  async function handleAction(id: string, action: string) {
    if (processing[id]) return;
    setProcessing((prev) => ({ ...prev, [id]: true }));
    // When true, the finally block leaves the button busy (a background poll owns it).
    let keepBusy = false;

    const labels: Record<string, string> = {
      extract: "Extracting pages",
      analyze: "Starting AI analysis",
    };
    addToast(labels[action] || "Processing...", "info");

    const endpoints: Record<string, string> = {
      extract: `/api/catalogues/${id}/control`,
      analyze: `/api/catalogues/${id}/control`,
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
        const data = await res.json().catch(() => null);
        fetchCatalogues();
        if (action === "analyze") startPolling(id);
        if ((action === "extract" || action === "analyze") && data?.jobId) {
          addToast(
            data.queued === false
              ? "Processing already in progress — watching it"
              : "Processing queued — worker will pick it up",
            "success"
          );
          if (action === "analyze") startPolling(id);
          keepBusy = true;
          pollJob(id, data.jobId, "processing");
          return;
        }
        addToast(`${labels[action]} started`, "success");
      } else {
        const err = await res.json();
        addToast(err.error || "Action failed", "error");
      }
    } catch (err) {
      console.error("Process error:", err);
      addToast("Action failed", "error");
    } finally {
      if (!keepBusy) setProcessing((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleControl(id: string, action: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    if (processing[id]) return;
    setProcessing((prev) => ({ ...prev, [id]: true }));
    // When true, the finally block leaves the button busy (a background poll owns it).
    let keepBusy = false;

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
        const data = await res.json().catch(() => null);
        fetchCatalogues();
        if (data?.jobId && (action === "resume" || action === "reset")) {
          addToast(
            data.queued === false
              ? "Processing already in progress — watching it"
              : "Processing queued — worker will pick it up",
            "success"
          );
          keepBusy = true;
          pollJob(id, data.jobId, "processing");
          return;
        }
        addToast(`${labels[action]} complete`, "success");
      } else {
        const err = await res.json();
        addToast(err.error || "Action failed", "error");
      }
    } catch (err) {
      console.error("Control error:", err);
      addToast("Action failed", "error");
    } finally {
      if (!keepBusy) setProcessing((prev) => ({ ...prev, [id]: false }));
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

  function openEdit(c: Catalogue) {
    setEditId(c.id);
    setEditForm({
      title: c.title,
      description: c.description ?? "",
      store: c.store || "marjane",
      type: c.type,
      status: c.status,
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10),
      sourceUrl: c.sourceUrl ?? "",
    });
  }

  async function handleStatusChange(id: string, status: string) {
    setStatusSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/catalogues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        addToast(`Status changed to ${status}`, "success");
        fetchCatalogues();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        addToast(err.error || "Failed to change status", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setStatusSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleSaveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/catalogues/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          store: editForm.store,
          type: editForm.type,
          status: editForm.status,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          sourceUrl: editForm.sourceUrl || null,
        }),
      });
      if (res.ok) {
        addToast("Catalogue updated", "success");
        setEditId(null);
        fetchCatalogues();
      } else {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        addToast(err.error || "Failed to save", "error");
      }
    } catch {
      addToast("Network error", "error");
    } finally {
      setSaving(false);
    }
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500">
            {c.articleCount > 0
              ? `${c.articleCount} article(s) — voir page Articles`
              : "Articles : voir page Articles"}
          </span>
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Nouveau catalogue
            </button>
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline text-sm">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !uploading && setUploadOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Upload New Catalogue</h2>
              <button onClick={() => !uploading && setUploadOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Store *</label>
                <select value={formData.store}
                  onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="marjane">Marjane</option>
                  <option value="marjane_market">Marjane Market</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2">
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
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setUploadOpen(false)} disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={uploading}
                className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {uploading ? "Uploading..." : "Upload Catalogue"}
              </button>
            </div>
          </form>
          </div>
        </div>
        )}

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
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/catalogues/${c.id}`} onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline font-medium">{c.title}</Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                            className="text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                            title="Edit catalogue"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.store === "marjane_market" ? "Marjane Market" : "Marjane"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(c.startDate).toLocaleDateString("fr-FR")} → {new Date(c.endDate).toLocaleDateString("fr-FR")}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(c.status, c.paused)}`}>
                          {getStatusLabel(c.status, c.paused)}
                        </span>
                        <select
                          value={c.status}
                          disabled={statusSaving[c.id]}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusChange(c.id, e.target.value)}
                          className="mt-2 block w-full text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          title="Change status"
                        >
                          {CATALOGUE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
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
                        {jobLog[c.id] && (
                          <p className="mt-1.5 max-w-64 truncate font-mono text-[11px] text-gray-500" title={jobLog[c.id]}>
                            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 align-middle" />
                            {jobLog[c.id]}
                          </p>
                        )}
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

      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditId(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Edit Catalogue</h3>
              <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (texte éditorial SEO)</label>
                <textarea value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Texte de présentation affiché sur la page publique…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select value={editForm.store}
                  onChange={(e) => setEditForm((f) => ({ ...f, store: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="marjane">Marjane</option>
                  <option value="marjane_market">Marjane Market</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                <select value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATALOGUE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">PUBLISHED / REVIEW are visible on the site. ARCHIVED hides it.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={editForm.startDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={editForm.endDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
                <input type="url" value={editForm.sourceUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editForm.title.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}