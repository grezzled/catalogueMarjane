"use client";

import Link from "next/link";
import { FileText, LayoutGrid, Megaphone } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  primaryKeyword: string | null;
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
    <aside className="space-y-6">
      {articles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-orange-100 rounded-lg p-1.5">
              <FileText className="h-4 w-4 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Articles associés</h3>
          </div>
          <div className="space-y-3">
            {articles.slice(0, 5).map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="block group"
              >
                <div className="flex items-start gap-2">
                  {article.primaryKeyword && (
                    <span className="text-[9px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                      {article.primaryKeyword}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors leading-snug mt-1 line-clamp-2">
                  {article.title}
                </p>
                {article.excerpt && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                    {article.excerpt}
                  </p>
                )}
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
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-gray-100 rounded-lg p-1.5">
              <LayoutGrid className="h-4 w-4 text-gray-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Catégories</h3>
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
    </aside>
  );
}
