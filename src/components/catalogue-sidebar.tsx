"use client";

import Link from "next/link";
import { FileText, LayoutGrid, Megaphone } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { articleTypeLabel } from "@/lib/article-types";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  primaryKeyword: string | null;
  articleType: string;
  articleFocus: string | null;
  publishedAt: Date | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CatalogueSidebarProps {
  articles: Article[];
  categories: Category[];
  currentCategory?: string;
}

export default function CatalogueSidebar({ articles, categories, currentCategory }: CatalogueSidebarProps) {
  return (
    <div className="space-y-10">
      {articles.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl p-2.5 shadow-lg shadow-orange-200">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Articles associés</h2>
              <p className="text-sm text-gray-500">Nos analyses et conseils</p>
            </div>
          </div>
          <div className="space-y-4">
            {articles.slice(0, 5).map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="group block bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {articleTypeLabel(article.articleType)}
                    {article.articleFocus ? ` — ${article.articleFocus}` : ""}
                  </span>
                  <span className="text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    {article.primaryKeyword || "Conseil"}
                  </span>
                  {article.publishedAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(article.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </div>
                <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                  {article.title}
                </p>
                {article.excerpt && (
                  <p className="text-sm text-gray-500 line-clamp-2 mt-2">
                    {article.excerpt}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 mt-4 text-xs text-blue-600 font-medium group-hover:text-blue-700">
                  Lire l&apos;article
                  <svg className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </Link>
            ))}
          </div>
          {articles.length > 5 && (
            <Link
              href="/articles"
              className="block text-center text-xs text-blue-500 hover:text-blue-600 font-medium mt-4 pt-3 border-t border-gray-100"
            >
              Voir tous les articles
            </Link>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-400 rounded-xl p-2.5 shadow-lg shadow-indigo-200">
              <LayoutGrid className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Catégories</h2>
              <p className="text-sm text-gray-500">Explorer par rayon</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.name);
              const isCurrent = cat.name === currentCategory;
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
                    isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {cat.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/*<div className="bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-gray-200 rounded-lg p-1.5">
            <Megaphone className="h-4 w-4 text-gray-500" />
          </div>
          <h3 className="font-bold text-gray-500 text-sm">Publicité</h3>
        </div>
        <div className="bg-gray-200/50 rounded-lg h-32 flex items-center justify-center">
          <span className="text-xs text-gray-400">Espace publicitaire</span>
        </div>
      </div>*/}
    </div>
  );
}
