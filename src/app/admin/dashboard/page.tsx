"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  catalogues: number;
  pagesProcessed: number;
  productsExtracted: number;
  offersExtracted: number;
  articlesGenerated: number;
  articlesPublished: number;
  articlesAwaitingReview: number;
  aiErrors: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Admin Dashboard
        </h1>

        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Catalogues" value={stats.catalogues} />
            <StatCard title="Pages Processed" value={stats.pagesProcessed} />
            <StatCard title="Products Extracted" value={stats.productsExtracted} />
            <StatCard title="Offers Extracted" value={stats.offersExtracted} />
            <StatCard title="Articles Generated" value={stats.articlesGenerated} />
            <StatCard title="Published" value={stats.articlesPublished} color="green" />
            <StatCard title="Awaiting Review" value={stats.articlesAwaitingReview} color="yellow" />
            <StatCard title="AI Errors" value={stats.aiErrors} color="red" />
          </div>
        ) : (
          <div className="text-center py-12">Loading stats...</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/catalogues"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Manage Catalogues
            </h2>
            <p className="text-gray-600">
              Upload, process, and manage Marjane catalogues
            </p>
          </Link>

          <Link
            href="/admin/articles"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Manage Articles
            </h2>
            <p className="text-gray-600">
              Review, approve, and publish SEO articles
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color = "blue",
}: {
  title: string;
  value: number;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-900",
    green: "bg-green-50 text-green-900",
    yellow: "bg-yellow-50 text-yellow-900",
    red: "bg-red-50 text-red-900",
  };

  return (
    <div className={`p-6 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
