import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["cataloguemarjane.com", "www.cataloguemarjane.com"],
  async redirects() {
    return [
      // /recherche was renamed to /produits before ever being deployed —
      // keep the redirect for stray links.
      { source: "/recherche", destination: "/produits", permanent: true },
      { source: "/recherche/:path*", destination: "/produits/:path*", permanent: true },
    ];
  },
};

export default nextConfig;