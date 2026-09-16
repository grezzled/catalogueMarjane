import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminCookieValue,
  getAdminSecret,
  passwordsEqual,
} from "@/lib/admin-auth";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    // Next.js dev server may not set these; fall back so limiting still works per-instance
    "unknown"
  );
}

export async function POST(request: Request) {
  const secret = getAdminSecret();
  if (!secret) {
    console.error(
      "ADMIN_SECRET is missing or shorter than 32 chars — admin login disabled."
    );
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD is not set — admin login disabled.");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkLoginRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  if (typeof password !== "string" || !passwordsEqual(password, adminPassword)) {
    return NextResponse.json(
      { error: "Mot de passe incorrect" },
      { status: 401 }
    );
  }

  await clearLoginRateLimit(ip);

  const cookieValue = createAdminCookieValue();
  if (!cookieValue) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
