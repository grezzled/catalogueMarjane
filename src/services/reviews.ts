import prisma from "@/lib/prisma";

export interface ReviewSummary {
  count: number;
  average: number | null;
  /** index 0 = 1 star … index 4 = 5 stars */
  distribution: [number, number, number, number, number];
  recommendRate: number | null;
}

export interface PublishedReview {
  id: string;
  author: string;
  rating: number;
  title: string | null;
  content: string;
  recommend: boolean | null;
  helpful: number;
  createdAt: string;
}

export const REVIEW_MIN_CONTENT = 10;
export const REVIEW_MAX_CONTENT = 2000;
export const REVIEW_MAX_TITLE = 80;

/** Aggregate rating over PUBLISHED reviews (used by the page + JSON-LD). */
export async function getProductReviewSummary(productId: string): Promise<ReviewSummary> {
  const rows = await prisma.review.findMany({
    where: { productId, status: "PUBLISHED" },
    select: { rating: true, recommend: true },
  });
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum = 0;
  let recYes = 0;
  let recTotal = 0;
  for (const r of rows) {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating - 1] += 1;
      sum += r.rating;
    }
    if (r.recommend != null) {
      recTotal += 1;
      if (r.recommend) recYes += 1;
    }
  }
  return {
    count: rows.length,
    average: rows.length > 0 ? sum / rows.length : null,
    distribution,
    recommendRate: recTotal > 0 ? recYes / recTotal : null,
  };
}

/** PUBLISHED reviews with helpful counts, newest first. */
export async function getPublishedReviews(productId: string, take = 200): Promise<PublishedReview[]> {
  const rows = await prisma.review.findMany({
    where: { productId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      author: true,
      rating: true,
      title: true,
      content: true,
      recommend: true,
      createdAt: true,
      _count: { select: { votes: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    title: r.title,
    content: r.content,
    recommend: r.recommend,
    helpful: r._count.votes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function validateReview(input: {
  author: unknown;
  rating: unknown;
  title: unknown;
  content: unknown;
  recommend: unknown;
}): { author: string; rating: number; title: string | null; content: string; recommend: boolean | null } | { error: string } {
  const author = typeof input.author === "string" ? input.author.trim().replace(/\s+/g, " ") : "";
  if (author.length < 2 || author.length > 40) return { error: "Indiquez un pseudo entre 2 et 40 caractères." };
  const rating = typeof input.rating === "number" ? input.rating : parseInt(String(input.rating), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choisissez une note de 1 à 5 étoiles." };
  const titleRaw = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  if (titleRaw.length > REVIEW_MAX_TITLE) return { error: `Le titre ne doit pas dépasser ${REVIEW_MAX_TITLE} caractères.` };
  const content = typeof input.content === "string" ? input.content.trim().replace(/\r/g, "") : "";
  if (content.length < REVIEW_MIN_CONTENT || content.length > REVIEW_MAX_CONTENT) {
    return { error: `L'avis doit contenir entre ${REVIEW_MIN_CONTENT} et ${REVIEW_MAX_CONTENT} caractères.` };
  }
  const recommend =
    input.recommend === true || input.recommend === "true" || input.recommend === "yes" || input.recommend === 1
      ? true
      : input.recommend === false || input.recommend === "false" || input.recommend === "no" || input.recommend === 0
        ? false
        : null;
  return { author, rating, title: titleRaw || null, content, recommend };
}
