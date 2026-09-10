import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          <Link href="/" className="hover:text-gray-300">
            Site
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
