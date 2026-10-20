import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { adminGuard } from "@/lib/require-admin";
import { revalidateCatalogue, revalidateSite } from "@/lib/revalidate";

interface PickInput {
  productId?: unknown;
  reason?: unknown;
}

function sentenceCount(value: string): number {
  return value
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;
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

    const action = body.action === "approve" ? "approve" : "save";
    const intro = typeof body.intro === "string" ? body.intro.trim() : "";
    const tip = typeof body.tip === "string" ? body.tip.trim() : "";
    const rawPicks: PickInput[] = Array.isArray(body.picks) ? body.picks : [];

    if (!intro) {
      return NextResponse.json({ error: "L'introduction est obligatoire." }, { status: 400 });
    }
    if (intro.length > 1500) {
      return NextResponse.json({ error: "L'introduction est trop longue (1500 caractères max)." }, { status: 400 });
    }
    if (!tip) {
      return NextResponse.json({ error: "Le conseil d'achat est obligatoire." }, { status: 400 });
    }
    if (tip.length > 400) {
      return NextResponse.json({ error: "Le conseil d'achat est trop long (400 caractères max)." }, { status: 400 });
    }

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
      include: {
        offers: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: { salePrice: "asc" },
        },
      },
    });
    if (!catalogue) {
      return NextResponse.json({ error: "Catalogue introuvable." }, { status: 404 });
    }

    const offerByProduct = new Map<string, (typeof catalogue.offers)[number]>();
    for (const offer of catalogue.offers) {
      if (!offerByProduct.has(offer.productId)) offerByProduct.set(offer.productId, offer);
    }

    const minPicks = Math.min(3, offerByProduct.size);
    if (rawPicks.length < minPicks || rawPicks.length > 5) {
      return NextResponse.json(
        {
          error: `Sélectionnez entre ${minPicks} et 5 produits pour « Notre sélection ».`,
        },
        { status: 400 }
      );
    }

    const seen = new Set<string>();
    const picks: Array<{
      productId: string;
      name: string;
      slug: string | null;
      salePrice: number | null;
      originalPrice: number | null;
      discountPercentage: number | null;
      reason: string;
    }> = [];
    for (const raw of rawPicks) {
      const productId = typeof raw.productId === "string" ? raw.productId : "";
      const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
      if (!productId || !reason) {
        return NextResponse.json(
          { error: "Chaque sélection doit avoir un produit et une raison." },
          { status: 400 }
        );
      }
      if (reason.length > 400) {
        return NextResponse.json(
          { error: "Une raison de sélection est trop longue (400 caractères max)." },
          { status: 400 }
        );
      }
      if (seen.has(productId)) {
        return NextResponse.json(
          { error: "Un produit ne peut apparaître qu'une fois dans la sélection." },
          { status: 400 }
        );
      }
      const offer = offerByProduct.get(productId);
      if (!offer) {
        return NextResponse.json(
          { error: "Un produit sélectionné n'appartient pas à ce catalogue." },
          { status: 400 }
        );
      }
      seen.add(productId);
      picks.push({
        productId,
        name: offer.product.name,
        slug: offer.product.slug,
        salePrice: offer.salePrice,
        originalPrice: offer.originalPrice,
        discountPercentage: offer.discountPercentage,
        reason,
      });
    }

    if (action === "approve" && (sentenceCount(intro) < 2 || sentenceCount(intro) > 3)) {
      return NextResponse.json(
        { error: "L'introduction doit contenir 2 ou 3 phrases avant approbation." },
        { status: 400 }
      );
    }

    const pages = await prisma.cataloguePage.findMany({
      where: { catalogueId: id },
      select: { editorialTitle: true, editorialSummary: true },
    });
    const wordCount = countWords(
      [
        intro,
        tip,
        ...picks.map((p) => p.reason),
        ...pages.map((p) => p.editorialSummary ?? ""),
      ].join(" ")
    );
    if (action === "approve" && (wordCount < 400 || wordCount > 800)) {
      return NextResponse.json(
        {
          error: `Le texte éditorial complet doit contenir entre 400 et 800 mots (actuellement ${wordCount}).`,
        },
        { status: 400 }
      );
    }

    const wasPublished = catalogue.status === "PUBLISHED";
    const data: Record<string, unknown> = {
      description: intro,
      editorialPicks: JSON.stringify(picks),
      editorialTip: tip,
      editorialStatus: action === "approve" ? "Approved" : "Generated",
      editorialApprovedAt: action === "approve" ? new Date() : null,
    };

    // An edit to a live catalogue is unpublished until the new text is approved;
    // approving a catalogue that is not live moves it to the review queue.
    if ((action === "save" && wasPublished) || (action === "approve" && catalogue.status !== "PUBLISHED")) {
      data.status = "REVIEW";
    }

    const updated = await prisma.catalogue.update({
      where: { id },
      data,
    });

    if (wasPublished || updated.status === "PUBLISHED") {
      revalidateCatalogue(updated.slug);
      revalidateSite();
    }

    return NextResponse.json({
      success: true,
      editorialStatus: updated.editorialStatus,
      editorialApprovedAt: updated.editorialApprovedAt,
      status: updated.status,
      wordCount,
    });
  } catch (error) {
    console.error("Error saving editorial text:", error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le texte éditorial." },
      { status: 500 }
    );
  }
}
