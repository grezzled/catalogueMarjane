"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  excerpt: string | null;
  content: string;
  primaryKeyword: string | null;
  secondaryKeywords: string | null;
  searchIntent: string | null;
  category: string | null;
  status: string;
  seoScore: number | null;
  contentQualityScore: number | null;
  originalityScore: number | null;
  factualAccuracyScore: number | null;
  searchIntentScore: number | null;
  thinContentRisk: number | null;
  keywordStuffingRisk: number | null;
  recommendation: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  catalogue: { id: string; title: string; slug: string } | null;
  articleCategories: { category: { name: string; slug: string } }[];
  seoAnalysis: { analysis: string } | null;
  relatedArticles: { id: string; title: string; slug: string; status: string; excerpt: string | null }[];
  faq: unknown;
  relatedCategories: unknown;
}

interface EditFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string;
  searchIntent: string;
  category: string;
  status: string;
  faq: string;
  relatedCategories: string;
  articleCategories: string[];
}

function renderMarkdown(content: string): string {
  let html = content;
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-extrabold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-extrabold text-gray-900 mt-10 mb-4">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li class="flex gap-2"><span class="text-red-500 mt-1">•</span><span>$1</span></li>');

  function convertImagePath(src: string): string {
    if (src.includes('/public/uploads/')) {
      return src.slice(src.indexOf('/public/uploads/') + 7);
    }
    if (src.includes('uploads/')) {
      return '/' + src.slice(src.indexOf('uploads/'));
    }
    return src;
  }

  // Tables - process BEFORE images
  const tableRows: string[] = [];
  let inTableBlock = false;
  const linesForTable = html.split("\n");
  const processedLines: string[] = [];

  for (const line of linesForTable) {
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      inTableBlock = true;
      tableRows.push(line.trim());
    } else {
      if (inTableBlock && tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(2);
        const headerCells = headerRow
          .split("|")
          .filter((c) => c.trim())
          .map((c) => `<th class="px-3 py-2 bg-gray-50 border border-gray-200 text-left font-bold text-gray-900 text-xs">${c.trim()}</th>`)
          .join("");
        const rowsHtml = dataRows
          .map((row) => {
            const cells = row
              .split("|")
              .filter((c) => c.trim())
              .map((c) => {
                let cellContent = c.trim();
                // Convert markdown images to small table images
                cellContent = cellContent.replace(/!\[(.+?)\]\((.+?)\)/g, (_, alt, src) => {
                  const imageSrc = convertImagePath(src);
                  return `<div class="flex items-center"><img src="${imageSrc}" alt="${alt}" class="w-12 h-12 object-contain rounded" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-12 h-12 bg-gray-100 rounded items-center justify-center hidden"><svg class="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
                });
                // Handle bare image URLs
                if (cellContent.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  const imageSrc = convertImagePath(cellContent);
                  cellContent = `<div class="flex items-center"><img src="${imageSrc}" class="w-12 h-12 object-contain rounded" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-12 h-12 bg-gray-100 rounded items-center justify-center hidden"><svg class="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
                }
                return `<td class="px-3 py-2 border border-gray-200 text-xs">${cellContent}</td>`;
              })
              .join("");
            return `<tr class="hover:bg-gray-50">${cells}</tr>`;
          })
          .join("");
        processedLines.push(`<div class="overflow-x-auto my-4"><table class="w-full border-collapse rounded-lg overflow-hidden shadow-sm text-xs"><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
        tableRows.length = 0;
      }
      inTableBlock = false;
      processedLines.push(line);
    }
  }

  if (tableRows.length > 0) {
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(2);
    const headerCells = headerRow
      .split("|")
      .filter((c) => c.trim())
      .map((c) => `<th class="px-3 py-2 bg-gray-50 border border-gray-200 text-left font-bold text-gray-900 text-xs">${c.trim()}</th>`)
      .join("");
    const rowsHtml = dataRows
      .map((row) => {
        const cells = row
          .split("|")
          .filter((c) => c.trim())
          .map((c) => {
            let cellContent = c.trim();
            cellContent = cellContent.replace(/!\[(.+?)\]\((.+?)\)/g, (_, alt, src) => {
              const imageSrc = convertImagePath(src);
              return `<div class="flex items-center"><img src="${imageSrc}" alt="${alt}" class="w-12 h-12 object-contain rounded" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-12 h-12 bg-gray-100 rounded items-center justify-center hidden"><svg class="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
            });
            if (cellContent.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              const imageSrc = convertImagePath(cellContent);
              cellContent = `<div class="flex items-center"><img src="${imageSrc}" class="w-12 h-12 object-contain rounded" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-12 h-12 bg-gray-100 rounded items-center justify-center hidden"><svg class="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
            }
            return `<td class="px-3 py-2 border border-gray-200 text-xs">${cellContent}</td>`;
          })
          .join("");
        return `<tr class="hover:bg-gray-50">${cells}</tr>`;
      })
      .join("");
    processedLines.push(`<div class="overflow-x-auto my-4"><table class="w-full border-collapse rounded-lg overflow-hidden shadow-sm text-xs"><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
  }

  html = processedLines.join("\n");

  // Images (AFTER tables)
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, (match, alt, src) => {
    const imageSrc = convertImagePath(src);
    return `<div class="my-4"><img src="${imageSrc}" alt="${alt}" class="max-w-full h-auto rounded-lg shadow-sm" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="w-full h-24 bg-gray-100 rounded-lg items-center justify-center hidden"><svg class="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg></div></div>`;
  });

  // Links (AFTER images - so image markdown is not affected)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-700 underline">$1</a>');

  const finalLines = html.split("\n");
  let inList = false;
  const result: string[] = [];

  for (const line of finalLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("<li")) {
      if (!inList) {
        result.push('<ul class="space-y-2 my-4">');
        inList = true;
      }
      result.push(line);
    } else if (trimmed.startsWith("<h") || trimmed.startsWith("<tr")) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    } else if (trimmed === "") {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
    } else if (trimmed && !trimmed.startsWith("<")) {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(`<p class="text-gray-700 leading-relaxed my-3">${trimmed}</p>`);
    } else {
      result.push(line);
    }
  }

  if (inList) result.push("</ul>");
  return result.join("\n");
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

function ScoreBar({ label, score, max = 100 }: { label: string; score: number | null; max?: number }) {
  const pct = score !== null ? Math.round((score / max) * 100) : 0;
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{score !== null ? `${Math.round(score)}/${max}` : "-"}</span>
      </div>
      {score !== null && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export default function ArticleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rewriting, setRewriting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"write" | "preview">("write");

  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setToast({ type: "error", message: data.error });
        } else {
          setArticle(data);
        }
      })
      .catch(() => setToast({ type: "error", message: "Failed to load article" }))
      .finally(() => setLoading(false));
  }, [id]);

  function startEditing() {
    setEditForm({
      title: article?.title || "",
      slug: article?.slug || "",
      excerpt: article?.excerpt || "",
      content: article?.content || "",
      metaTitle: article?.metaTitle || "",
      metaDescription: article?.metaDescription || "",
      primaryKeyword: article?.primaryKeyword || "",
      secondaryKeywords: article?.secondaryKeywords || "",
      searchIntent: article?.searchIntent || "",
      category: article?.category || "",
      status: article?.status || "DRAFT",
      faq: article?.faq ? JSON.stringify(article.faq, null, 2) : "[]",
      relatedCategories: article?.relatedCategories ? JSON.stringify(article.relatedCategories) : "[]",
      articleCategories: article?.articleCategories?.map((ac) => ac.category.slug) || [],
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditForm(null);
  }

  async function handleSave() {
    if (!editForm) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: editForm.title,
        slug: editForm.slug,
        excerpt: editForm.excerpt,
        content: editForm.content,
        metaTitle: editForm.metaTitle,
        metaDescription: editForm.metaDescription,
        primaryKeyword: editForm.primaryKeyword,
        secondaryKeywords: editForm.secondaryKeywords,
        searchIntent: editForm.searchIntent,
        category: editForm.category,
        status: editForm.status,
        faq: editForm.faq ? JSON.parse(editForm.faq) : [],
        relatedCategories: editForm.relatedCategories ? JSON.parse(editForm.relatedCategories) : [],
      };

      const res = await fetch(`/api/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setArticle((prev) => prev ? { ...prev, ...data.article } : prev);
        setEditing(false);
        setEditForm(null);
        setToast({ type: "success", message: "Article updated" });
      } else {
        const err = await res.json();
        setToast({ type: "error", message: err.error || "Save failed" });
      }
    } catch {
      setToast({ type: "error", message: "Save failed" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function updateEditForm(field: keyof EditFormData, value: string | string[]) {
    setEditForm((prev) => prev ? { ...prev, [field]: value } : null);
  }

  async function handleAction(action: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/articles/${id}/${action}`, { method: "POST" });
      if (res.ok) {
        setArticle((prev) =>
          prev
            ? {
                ...prev,
                status: action === "publish" ? "PUBLISHED" : action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : action === "unpublish" ? "APPROVED" : prev.status,
                publishedAt: action === "publish" ? new Date().toISOString() : action === "unpublish" ? null : prev.publishedAt,
              }
            : prev
        );
        setToast({ type: "success", message: `Article ${action}d` });
      }
    } catch {
      setToast({ type: "error", message: "Action failed" });
    } finally {
      setActionLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleRewrite() {
    if (!article?.catalogue?.id) return;
    setRewriting(true);
    try {
      const res = await fetch(`/api/catalogues/${article.catalogue.id}/generate-article`, { method: "POST" });
      if (res.ok) {
        setToast({ type: "success", message: "Rewrite started" });
      }
    } catch {
      setToast({ type: "error", message: "Rewrite failed" });
    } finally {
      setRewriting(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this article? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/articles/${id}/delete`, { method: "POST" });
      if (res.ok) {
        window.location.href = "/admin/articles";
      }
    } catch {
      setToast({ type: "error", message: "Delete failed" });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (!article) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Article not found</div>;

  const renderedContent = renderMarkdown(editing ? editForm?.content || "" : article.content);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            {toast.message}
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin/articles" className="text-blue-600 hover:underline text-sm">← Back to Articles</Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">{editing ? editForm?.title || article.title : article.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(editing ? editForm?.status || article.status : article.status)}`}>
              {editing ? editForm?.status || article.status : article.status}
            </span>
            {!editing && (
              <button onClick={startEditing} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Edit</button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Edit Article</h2>
                <div className="flex gap-3">
                  <button onClick={cancelEditing} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">{saving ? "Saving..." : "Save"}</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input type="text" value={editForm?.title || ""} onChange={(e) => updateEditForm("title", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input type="text" value={editForm?.slug || ""} onChange={(e) => updateEditForm("slug", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={editForm?.status || "DRAFT"} onChange={(e) => updateEditForm("status", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="DRAFT">Draft</option>
                    <option value="REVIEW">Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                  <textarea value={editForm?.excerpt || ""} onChange={(e) => updateEditForm("excerpt", e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Keyword</label>
                  <input type="text" value={editForm?.primaryKeyword || ""} onChange={(e) => updateEditForm("primaryKeyword", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Intent</label>
                  <select value={editForm?.searchIntent || ""} onChange={(e) => updateEditForm("searchIntent", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">None</option>
                    <option value="informational">Informational</option>
                    <option value="commercial">Commercial</option>
                    <option value="transactional">Transactional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input type="text" value={editForm?.category || ""} onChange={(e) => updateEditForm("category", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                  <input type="text" value={editForm?.metaTitle || ""} onChange={(e) => updateEditForm("metaTitle", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                  <textarea value={editForm?.metaDescription || ""} onChange={(e) => updateEditForm("metaDescription", e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Content (Markdown)</h2>
                <div className="flex gap-2">
                  <button onClick={() => setPreviewMode("write")} className={`px-3 py-1 text-sm font-medium rounded ${previewMode === "write" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>Write</button>
                  <button onClick={() => setPreviewMode("preview")} className={`px-3 py-1 text-sm font-medium rounded ${previewMode === "preview" ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>Preview</button>
                </div>
              </div>
              {previewMode === "write" ? (
                <textarea value={editForm?.content || ""} onChange={(e) => updateEditForm("content", e.target.value)} rows={30} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              ) : (
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">FAQ (JSON)</h2>
              <textarea value={editForm?.faq || ""} onChange={(e) => updateEditForm("faq", e.target.value)} rows={6} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Related Categories (JSON)</h2>
              <textarea value={editForm?.relatedCategories || ""} onChange={(e) => updateEditForm("relatedCategories", e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Actions</h2>
                <div className="flex flex-wrap gap-3">
                  {article.catalogue?.id && (
                    <button onClick={handleRewrite} disabled={rewriting || actionLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                      {rewriting ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>}
                      {rewriting ? "Rewriting..." : "Rewrite"}
                    </button>
                  )}
                  {article.status === "REVIEW" && (
                    <>
                      <button onClick={() => handleAction("approve")} disabled={actionLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">Approve</button>
                      <button onClick={() => handleAction("reject")} disabled={actionLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium">Reject</button>
                    </>
                  )}
                  {article.status === "APPROVED" && (
                    <button onClick={() => handleAction("publish")} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">Publish</button>
                  )}
                  {article.status === "PUBLISHED" && (
                    <>
                      <Link href={`/articles/${article.slug}`} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium">View Live</Link>
                      <button onClick={() => handleAction("unpublish")} disabled={actionLoading} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium">Unpublish</button>
                    </>
                  )}
                  <button onClick={handleDelete} disabled={actionLoading} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm font-medium ml-auto">Delete</button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Content Preview</h2>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">SEO Scores</h2>
                <div className="space-y-4">
                  <ScoreBar label="SEO Score" score={article.seoScore} />
                  <ScoreBar label="Content Quality" score={article.contentQualityScore} />
                  <ScoreBar label="Originality" score={article.originalityScore} />
                  <ScoreBar label="Factual Accuracy" score={article.factualAccuracyScore} />
                  <ScoreBar label="Search Intent" score={article.searchIntentScore} />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Risks</h2>
                <div className="space-y-4">
                  <ScoreBar label="Thin Content Risk" score={article.thinContentRisk} />
                  <ScoreBar label="Keyword Stuffing" score={article.keywordStuffingRisk} />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Details</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-500">Keyword</dt><dd className="text-gray-900 font-medium">{article.primaryKeyword || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Intent</dt><dd className="text-gray-900 font-medium">{article.searchIntent || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Recommendation</dt><dd className="text-gray-900 font-medium">{article.recommendation || "-"}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Created</dt><dd className="text-gray-900 font-medium">{new Date(article.createdAt).toLocaleDateString()}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Updated</dt><dd className="text-gray-900 font-medium">{new Date(article.updatedAt).toLocaleDateString()}</dd></div>
                  {article.publishedAt && (
                    <div className="flex justify-between"><dt className="text-gray-500">Published</dt><dd className="text-gray-900 font-medium">{new Date(article.publishedAt).toLocaleDateString()}</dd></div>
                  )}
                </dl>
              </div>

              {article.catalogue && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Catalogue associé</h2>
                  <Link href={`/admin/catalogues/${article.catalogue.id}`} className="text-blue-600 hover:underline text-sm">{article.catalogue.title}</Link>
                </div>
              )}

              {article.relatedArticles && article.relatedArticles.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Articles connexes</h2>
                  <div className="space-y-3">
                    {article.relatedArticles.map((related) => (
                      <Link key={related.id} href={`/admin/articles/${related.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="font-medium text-gray-900 text-sm line-clamp-1">{related.title}</div>
                        {related.excerpt && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{related.excerpt}</div>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${related.status === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{related.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {article.articleCategories.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Categories</h2>
                  <div className="flex flex-wrap gap-2">
                    {article.articleCategories.map((ac) => (
                      <span key={ac.category.slug} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">{ac.category.name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Meta</h2>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-gray-500">Slug</dt><dd className="text-gray-900 font-mono text-xs mt-1">/{article.slug}</dd></div>
                  <div><dt className="text-gray-500">Meta Title</dt><dd className="text-gray-900 mt-1">{article.metaTitle || "-"}</dd></div>
                  <div><dt className="text-gray-500">Meta Description</dt><dd className="text-gray-900 mt-1">{article.metaDescription || "-"}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
