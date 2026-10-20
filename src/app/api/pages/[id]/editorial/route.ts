import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { revalidateCatalogue, revalidateSite } from "@/lib/revalidate";

function sentences(value: string): string[] {
  return value
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();

    const editorialTitle =
      typeof body.editorialTitle === "string" ? body.editorialTitle.trim() : "";
    const editorialSummary =
      typeof body.editorialSummary === "string" ? body.editorialSummary.trim() : "";
    const imageAlt = typeof body.imageAlt === "string" ? body.imageAlt.trim() : "";

    if (!editorialTitle || editorialTitle.split(/\s+/).filter(Boolean).length > 8) {
      return NextResponse.json(
        { error: "Le titre de page doit contenir 1 à 8 mots." },
        { status: 400 }
      );
    }
    if (editorialSummary.length < 40 || editorialSummary.length > 600) {
      return NextResponse.json(
        { error: "Le résumé doit contenir entre 40 et 600 caractères." },
        { status: 400 }
      );
    }
    const summarySentences = sentences(editorialSummary);
    if (summarySentences.length < 2 || summarySentences.length > 3) {
      return NextResponse.json(
        { error: "Le résumé doit contenir 2 ou 3 phrases." },
        { status: 400 }
      );
    }
    if (!imageAlt || imageAlt.length > 300) {
      return NextResponse.json(
        { error: "Le texte alternatif est obligatoire (300 caractères max)." },
        { status: 400 }
      );
    }
    if (sentences(imageAlt).length > 1) {
      return NextResponse.json(
        { error: "Le texte alternatif doit tenir en une phrase." },
        { status: 400 }
      );
    }

    const page = await prisma.cataloguePage.findUnique({
      where: { id },
      include: {
        catalogue: { select: { id: true, slug: true, status: true, editorialStatus: true } },
      },
    });
    if (!page) {
      return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    }

    await prisma.cataloguePage.update({
      where: { id },
      data: { editorialTitle, editorialSummary, imageAlt },
    });

    const revokeApproval =
      page.catalogue.status === "PUBLISHED" ||
      page.catalogue.editorialStatus === "Approved";

    if (revokeApproval) {
      await prisma.catalogue.update({
        where: { id: page.catalogueId },
        data: {
          status: "REVIEW",
          editorialStatus: "Generated",
          editorialApprovedAt: null,
        },
      });
      revalidateCatalogue(page.catalogue.slug);
      revalidateSite();
    }

    return NextResponse.json({
      success: true,
      editorialTitle,
      editorialSummary,
      imageAlt,
      approvalRevoked: revokeApproval,
    });
  } catch (error) {
    console.error("Error saving page editorial text:", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le texte de cette page." },
      { status: 500 }
    );
  }
}
