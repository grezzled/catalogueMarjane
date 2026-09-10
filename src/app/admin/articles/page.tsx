"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewriting, setRewriting] = useState<Record<string, boolean>>({});

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

  async function handleRewrite(article: Article) {
    if (!article.catalogueId) return;
    setRewriting((prev) => ({ ...prev, [article.id]: true }));
    try {
      const res = await fetch(`/api/catalogues/${article.catalogueId}/generate-article`, {
        method: "POST",
      });
      if (res.ok) fetchArticles();
    } catch (err) {
      console.error("Rewrite error:", err);
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
      REJECTED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
          <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
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
      </div>
    </div>
  );
}
