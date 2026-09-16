import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, verifyAdminCookie } from "@/lib/admin-auth";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value);
}

/** All descendant ids (replies of replies…) for cascade reject. */
async function descendantIds(rootId: string): Promise<string[]> {
  const ids: string[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await prisma.comment.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

export async function PATCH(request: Request, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { action } = (body ?? {}) as { action?: unknown };
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
  }

  try {
    if (action === "approve") {
      await prisma.comment.update({ where: { id }, data: { status: "PUBLISHED" } });
    } else {
      // Reject the whole thread below so no orphaned replies leak to roots.
      const ids = [id, ...(await descendantIds(id))];
      await prisma.comment.updateMany({ where: { id: { in: ids } }, data: { status: "REJECTED" } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Moderation error:", error);
    return NextResponse.json({ error: "Action impossible." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
  }

  try {
    // Replies cascade via FK; votes cascade too.
    await prisma.comment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Comment delete error:", error);
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }
}
