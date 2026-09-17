import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

// One helpful-vote per browser is enforced client-side (localStorage);
// server-side we throttle bursts per IP.
const WINDOW_MS = 60 * 1000;
const MAX_VOTES = 20;
const votes = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Mark a PUBLISHED review as helpful (+1). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const now = Date.now();
  const ip = clientIp(request);
  const entry = votes.get(ip);
  if (!entry || now > entry.resetAt) {
    votes.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
    if (entry.count > MAX_VOTES) {
      return NextResponse.json({ error: "Trop de votes. Réessayez dans une minute." }, { status: 429 });
    }
  }

  const review = await prisma.review.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }
  try {
    await prisma.reviewVote.create({ data: { reviewId: id } });
    const helpful = await prisma.reviewVote.count({ where: { reviewId: id } });
    return NextResponse.json({ helpful });
  } catch (error) {
    console.error("Review vote error:", error);
    return NextResponse.json({ error: "Vote impossible pour le moment." }, { status: 500 });
  }
}
