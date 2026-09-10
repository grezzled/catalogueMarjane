import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac } from "crypto";

const SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD + "_secret_key";

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

// Simple in-memory rate limiter
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now > attempt.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 min window
    return true;
  }

  if (attempt.count >= 5) {
    return false; // 5 attempts max
  }

  attempt.count++;
  return true;
}

export async function POST(request: Request) {
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  if (!adminPassword) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Rate limit check
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429 }
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  // Success - sign the cookie value
  const cookieValue = sign("authenticated");

  const cookieStore = await cookies();
  cookieStore.set("admin_auth", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return NextResponse.json({ success: true });
}
