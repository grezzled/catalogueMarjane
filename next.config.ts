import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["cataloguemarjane.com", "www.cataloguemarjane.com"],
  experimental: {
    // src/proxy.ts matches /api/catalogues — default proxy body buffer is
    // 10MB, which truncates larger catalogue PDFs and makes
    // request.formData() throw "Failed to parse body as FormData".
    // MAX_UPLOAD_SIZE_MB=50 + nginx client_max_body_size 60M, so allow 60MB.
    proxyClientMaxBodySize: "60mb",
  },
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