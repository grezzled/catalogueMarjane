import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail } from "@/services/subscribers";

export const runtime = "nodejs";

const SUBJECTS = ["Erreur de prix", "Suggestion", "Question", "Autre"] as const;

const contactSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().max(254),
  subject: z.enum(SUBJECTS),
  message: z.string().trim().min(10).max(2000),
  // Honeypot: filled only by bots, must stay empty.
  website: z.string().max(0).optional(),
});

// Tiny in-memory throttle: 5 messages / 15 min per IP.
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
      { error: "Trop de messages envoyés. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifiez votre adresse e-mail et votre message (10 caractères minimum)." },
      { status: 400 }
    );
  }

  const { name, email, subject, message } = parsed.data;

  if (parsed.data.website) {
    return NextResponse.json({ success: true });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  try {
    await prisma.contactMessage.create({
      data: {
        name: name || null,
        email: normalizeEmail(email),
        subject,
        message,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact message error:", error);
    return NextResponse.json(
      { error: "Envoi impossible pour le moment. Réessayez plus tard." },
      { status: 500 }
    );
  }
}
