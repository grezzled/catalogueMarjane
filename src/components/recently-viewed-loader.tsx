"use client";

import dynamic from "next/dynamic";

// Client-only wrapper: ssr:false is not allowed in Server Components,
// so pages import this instead of recently-viewed directly.
const RecentlyViewed = dynamic(
  () => import("@/components/recently-viewed").then((m) => m.RecentlyViewed),
  { ssr: false }
);

export default function RecentlyViewedLoader(props: { excludeSlug?: string; title?: string }) {
  return <RecentlyViewed {...props} />;
}
