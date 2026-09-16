import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REACTION_EMOJIS } from "@/app/api/comments/route";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

// In-memory throttle: 60 reactions / 15 min per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REACTS = 60;
const reacts = new Map<string, { count: number; resetAt: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = reacts.get(ip);
  if (!entry || now > entry.resetAt) {
    reacts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REACTS;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (throttled(clientIp(request))) {
    return NextResponse.json(
      { error: "Trop de réactions. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { emoji } = (body ?? {}) as { emoji?: unknown };
  if (typeof emoji !== "string" || !(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return NextResponse.json({ error: "Émoji invalide." }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!comment || comment.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
  }

  try {
    await prisma.commentVote.create({ data: { commentId: id, emoji } });
    const votes = await prisma.commentVote.groupBy({
      by: ["emoji"],
      where: { commentId: id },
      _count: { _all: true },
    });
    const reactions: Record<string, number> = {};
    for (const v of votes) reactions[v.emoji] = v._count._all;
    return NextResponse.json({ reactions });
  } catch (error) {
    console.error("React error:", error);
    return NextResponse.json({ error: "Réaction impossible pour le moment." }, { status: 500 });
  }
}
