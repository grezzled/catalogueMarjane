import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import JobTerminal from "@/components/admin/job-terminal";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let pendingComments = 0;
  try {
    pendingComments = await prisma.comment.count({ where: { status: "PENDING" } });
  } catch {
    // comments table may predate migration — badge simply stays hidden
  }
  return (
    <div>
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <Link href="/admin/dashboard" className="font-bold">
          Admin
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin/dashboard" className="hover:text-gray-300">
            Dashboard
          </Link>
          <Link href="/admin/catalogues" className="hover:text-gray-300">
            Catalogues
          </Link>
          <Link href="/admin/articles" className="hover:text-gray-300">
            Articles
          </Link>
          <Link href="/admin/comments" className="hover:text-gray-300 inline-flex items-center gap-1.5">
            Commentaires
            {pendingComments > 0 && (
              <span className="bg-amber-400 text-amber-950 text-[11px] font-bold rounded-full px-1.5 py-0.5 tabular-nums">
                {pendingComments}
              </span>
            )}
          </Link>
          <Link href="/admin/seo" className="hover:text-gray-300">
            SEO
          </Link>
          <Link href="/admin/settings" className="hover:text-gray-300">
            Settings
          </Link>
          <Link href="/" className="hover:text-gray-300">
            Site
          </Link>
          <LogoutButton />
        </div>
      </div>
      {children}
      <JobTerminal />
    </div>
  );
}
