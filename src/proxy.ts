import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "admin_auth";
const COOKIE_VERSION = "v1";

function getSecret(): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verify(value: string): Promise<boolean> {
  if (!value) return false;
  const secret = getSecret();
  if (!secret) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [version, expStr, sigHex] = parts;
  if (version !== COOKIE_VERSION) return false;

  const exp = Number(expStr);
  if (!Number.isInteger(exp)) return false;
  if (exp * 1000 <= Date.now()) return false;

  const sig = hexToBytes(sigHex);
  if (!sig) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = encoder.encode(`${COOKIE_VERSION}:admin-auth:${exp}`);
    return crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}

const PUBLIC_PATHS = new Set([
  "/admin/login",
  "/api/admin/auth",
  "/api/admin/logout",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value || "";
  const isAuthenticated = await verify(cookieValue);

  if (!isAuthenticated) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/catalogues",
    "/api/catalogues/:path*",
    "/api/articles",
    "/api/articles/:path*",
    "/api/pages/:path*",
    "/api/worker/:path*",
    "/api/seo/:path*",
    "/api/revalidate",
    "/api/jobs",
    "/api/jobs/:path*",
    "/api/stats",
    "/api/og-settings",
  ],
};
