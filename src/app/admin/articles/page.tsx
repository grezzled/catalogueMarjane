"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { articleTypeLabel } from "@/lib/article-types";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  primaryKeyword: string | null;
  seoScore: number | null;
  contentQualityScore: number | null;
  recommendation: string | null;
  publishedAt: string | null;
  createdAt: string;
  catalogueId: string | null;
  articleType: string;
  articleFocus: string | null;
}

interface GenerationLog {
  step: string;
  status: "pending" | "in_progress" | "completed" | "error";
  message: string;
  timestamp: string;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewriting, setRewriting] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  async function fetchArticles() {
    try {
      const res = await fetch("/api/articles");
      const data = await res.json();
      setArticles(data);
    } catch (err) {
      console.error("Failed to fetch articles:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: string) {
    try {
      const res = await fetch(`/api/articles/${id}/${action}`, {
        method: "POST",
      });
      if (res.ok) fetchArticles();
    } catch (err) {
      console.error("Action error:", err);
    }
  }

  async function pollRewriteJob(jobId: string) {
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) continue;
        const job = await res.json();
        const logs = job.result?.logs;
        if (Array.isArray(logs) && logs.length > 0) setLogs(logs);
        if (job.status === "COMPLETED" || job.status === "FAILED") {
          fetchArticles();
          return;
        }
      } catch (err) {
        console.error("Job poll error:", err);
      }
    }
  }

  async function handleRewrite(article: Article) {
    if (!article.catalogueId) return;
    setRewriting((prev) => ({ ...prev, [article.id]: true }));
    setLogs([]);
    setShowLogs(true);
    try {
      // Rewrite preserves the article's intent (type + focus category).
      const res = await fetch(`/api/catalogues/${article.catalogueId}/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleType: article.articleType ?? "overview",
          ...(article.articleFocus ? { category: article.articleFocus } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.jobId) {
        // Queued — stream the worker's step logs into the panel below.
        pollRewriteJob(data.jobId);
      } else if (res.ok) {
        fetchArticles();
      } else {
        setLogs([{ step: "error", status: "error", message: data?.error || "Failed to queue rewrite", timestamp: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error("Rewrite error:", err);
      setLogs([{ step: "error", status: "error", message: "Failed to generate article", timestamp: new Date().toISOString() }]);
    } finally {
      setRewriting((prev) => ({ ...prev, [article.id]: false }));
    }
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      GENERATING: "bg-blue-100 text-blue-800",
      GENERATED: "bg-purple-100 text-purple-800",
      REVIEW: "bg-orange-100 text-orange-800",
      APPROVED: "bg-green-100 text-green-800",
      PUBLISHED: "bg-green-100 text-green-800",
      EXPIRED: "bg-gray-200 text-gray-500",
      REJECTED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/articles/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              + Nouvel article
            </Link>
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    SEO Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Quality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Keyword
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {articles.map((a) => (
                  <tr key={a.id}>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/articles/${a.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {a.title}
                      </Link>
                      <p className="text-sm text-gray-500">/{a.slug}</p>
                      <span className="inline-flex mt-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700">
                        {articleTypeLabel(a.articleType)}
                        {a.articleFocus ? ` — ${a.articleFocus}` : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {a.seoScore !== null ? `${Math.round(a.seoScore)}/100` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {a.contentQualityScore !== null
                        ? `${Math.round(a.contentQualityScore)}/100`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {a.primaryKeyword || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      {a.catalogueId && (
                        <button
                          onClick={() => handleRewrite(a)}
                          disabled={rewriting[a.id]}
                          className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                        >
                          {rewriting[a.id] ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                          )}
                          {rewriting[a.id] ? "Rewriting..." : "Rewrite"}
                        </button>
                      )}
                      {a.status === "REVIEW" && (
                        <>
                          <button
                            onClick={() => handleAction(a.id, "approve")}
                            className="text-green-600 hover:underline"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(a.id, "reject")}
                            className="text-red-600 hover:underline"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {a.status === "APPROVED" && (
                        <button
                          onClick={() => handleAction(a.id, "publish")}
                          className="text-blue-600 hover:underline"
                        >
                          Publish
                        </button>
                      )}
                      {a.status === "EXPIRED" && (
                        <button
                          onClick={() => handleAction(a.id, "publish")}
                          className="text-blue-600 hover:underline"
                          title="Republish an expired article"
                        >
                          Republish
                        </button>
                      )}
                      {a.status === "PUBLISHED" && (
                        <Link
                          href={`/articles/${a.slug}`}
                          className="text-purple-600 hover:underline"
                          target="_blank"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showLogs && logs.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Generation Logs</h2>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    log.status === "error"
                      ? "bg-red-50 border border-red-200"
                      : log.status === "completed"
                      ? "bg-green-50 border border-green-200"
                      : log.status === "in_progress"
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {log.status === "in_progress" && (
                      <svg className="h-4 w-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {log.status === "completed" && (
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                    {log.status === "error" && (
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    )}
                    {log.status === "pending" && (
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{log.step}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.status === "error"
                          ? "bg-red-100 text-red-700"
                          : log.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : log.status === "in_progress"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{log.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
