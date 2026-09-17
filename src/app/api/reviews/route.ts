import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getProductReviewSummary, getPublishedReviews, validateReview } from "@/services/reviews";

export const runtime = "nodejs";

// In-memory throttle: 5 reviews / hour per IP (stricter than comments).
const WINDOW_MS = 60 * 60 * 1000;
const MAX_POSTS = 5;
const posts = new Map<string, { count: number; resetAt: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = posts.get(ip);
  if (!entry || now > entry.resetAt) {
    posts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_POSTS;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** PUBLISHED reviews + aggregate summary for a product. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "Produit manquant." }, { status: 400 });
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }
  const [reviews, summary] = await Promise.all([
    getPublishedReviews(productId),
    getProductReviewSummary(productId),
  ]);
  return NextResponse.json({ reviews, summary });
}

export async function POST(request: Request) {
  if (throttled(clientIp(request))) {
    return NextResponse.json(
      { error: "Trop d'avis envoyés. Réessayez dans une heure." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { productId, author, rating, title, content, recommend } = (body ?? {}) as {
    productId?: unknown;
    author?: unknown;
    rating?: unknown;
    title?: unknown;
    content?: unknown;
    recommend?: unknown;
  };
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "Produit invalide." }, { status: 400 });
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const validated = validateReview({ author, rating, title, content, recommend });
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  // One review per pseudo per product (case-insensitive; SQLite has no
  // insensitive mode, so compare in JS over this product's authors).
  const authors = await prisma.review.findMany({
    where: { productId, status: { in: ["PENDING", "PUBLISHED"] } },
    select: { author: true },
  });
  if (authors.some((r) => r.author.toLowerCase() === validated.author.toLowerCase())) {
    return NextResponse.json(
      { error: "Vous avez déjà donné votre avis sur ce produit." },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.review.create({
      data: {
        productId,
        author: validated.author,
        rating: validated.rating,
        title: validated.title,
        content: validated.content,
        recommend: validated.recommend,
        status: "PENDING",
      },
      select: { id: true },
    });
    return NextResponse.json({ pending: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Review create error:", error);
    return NextResponse.json({ error: "Publication impossible pour le moment." }, { status: 500 });
  }
}
