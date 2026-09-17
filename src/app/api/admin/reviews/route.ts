import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, verifyAdminCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value);
}

const STATUSES = ["PENDING", "PUBLISHED", "REJECTED"] as const;

/** Moderation queue for product reviews. */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "PENDING";

  const where = status === "ALL" || !STATUSES.includes(status as (typeof STATUSES)[number])
    ? {}
    : { status };

  const [rows, counts] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        author: true,
        rating: true,
        title: true,
        content: true,
        recommend: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true } },
        _count: { select: { votes: true } },
      },
    }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus: Record<string, number> = { PENDING: 0, PUBLISHED: 0, REJECTED: 0 };
  for (const c of counts) byStatus[c.status] = c._count._all;

  return NextResponse.json({
    reviews: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      helpful: r._count.votes,
    })),
    counts: byStatus,
  });
}
