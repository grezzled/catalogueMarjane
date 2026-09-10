import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD + "_secret_key";

async function verify(value: string): Promise<boolean> {
  if (!value) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const bytes = value.match(/.{1,2}/g);
  if (!bytes) return false;
  const signature = Uint8Array.from(bytes.map((byte) => parseInt(byte, 16)));
  const data = encoder.encode("authenticated");

  return crypto.subtle.verify("HMAC", key, signature, data);
}

export async function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get("admin_auth")?.value || "";
  const isAuthenticated = await verify(cookieValue);

  if (!isAuthenticated) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard", "/admin/catalogues/:path*", "/admin/articles/:path*"],
};
