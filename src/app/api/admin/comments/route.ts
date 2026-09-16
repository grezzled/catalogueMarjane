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
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        targetType: true,
        author: true,
        content: true,
        status: true,
        createdAt: true,
        parentId: true,
        parent: { select: { author: true } },
        catalogue: { select: { id: true, title: true, slug: true } },
        article: { select: { id: true, title: true, slug: true } },
        _count: { select: { votes: true, replies: true } },
      },
    }),
    prisma.comment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus: Record<string, number> = { PENDING: 0, PUBLISHED: 0, REJECTED: 0 };
  for (const c of counts) byStatus[c.status] = c._count._all;

  return NextResponse.json({
    comments: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      votes: r._count.votes,
      replyCount: r._count.replies,
    })),
    counts: byStatus,
  });
}
