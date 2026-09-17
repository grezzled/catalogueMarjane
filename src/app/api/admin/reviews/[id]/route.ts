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

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!review) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }

  try {
    await prisma.review.update({
      where: { id },
      data: { status: action === "approve" ? "PUBLISHED" : "REJECTED" },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review moderation error:", error);
    return NextResponse.json({ error: "Action impossible." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true } });
  if (!review) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }

  try {
    // Helpful votes cascade via FK.
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review delete error:", error);
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }
}
