import { NextResponse } from "next/server";
import { isValidEmail, subscribeEmail } from "@/services/subscribers";

export const runtime = "nodejs";

// Tiny in-memory throttle: 5 subscribe attempts / 15 min per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  if (throttled(clientIp(request))) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { email, source } = (body ?? {}) as { email?: unknown; source?: unknown };

  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  try {
    const result = await subscribeEmail(
      email,
      typeof source === "string" && source.length <= 64 ? source : undefined
    );
    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Inscription impossible pour le moment." }, { status: 500 });
  }
}
