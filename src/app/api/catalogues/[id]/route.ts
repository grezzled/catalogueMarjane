import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { publishCatalogue, revalidateCatalogue, revalidateSite } from "@/lib/revalidate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
    });

    if (!catalogue) {
      return NextResponse.json({ error: "Catalogue not found" }, { status: 404 });
    }

    return NextResponse.json(catalogue);
  } catch (error) {
    console.error("Error fetching catalogue:", error);
    return NextResponse.json(
      { error: "Failed to fetch catalogue" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = ["title", "description", "type", "store", "startDate", "endDate", "status", "sourceUrl"];
    const allowedOgFields = [
      "ogBannerTitle",
      "ogBannerTitleAr",
      "ogBannerSubtitle",
      "ogBannerSubtitleAr",
      "ogBodyText",
      "ogBodyTextAr",
    ];
    const allowedStatuses = [
      "UPLOADED",
      "PROCESSING",
      "EXTRACTING",
      "ANALYZING",
      "STRUCTURING",
      "GENERATING",
      "REVIEW",
      "PUBLISHED",
      "FAILED",
      "ARCHIVED",
      "CANCELLED",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === "startDate" || key === "endDate") {
          data[key] = new Date(body[key]);
        } else if (key === "status") {
          if (typeof body[key] !== "string" || !allowedStatuses.includes(body[key])) {
            return NextResponse.json(
              { error: `Invalid status. Allowed: ${allowedStatuses.join(", ")}` },
              { status: 400 }
            );
          }
          data[key] = body[key];
        } else {
          data[key] = body[key];
        }
      }
    }
    // OG overrides: empty string resets to null (= inherit global settings)
    for (const key of allowedOgFields) {
      if (key in body) {
        const v = body[key];
        if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
          data[key] = null;
        } else if (typeof v === "string") {
          data[key] = v;
        } else {
          return NextResponse.json(
            { error: `Invalid value for ${key}: must be a string or null` },
            { status: 400 }
          );
        }
      }
    }
    // OG cover pages override: null/"" = inherit global, otherwise 1-3
    if ("ogCoverPages" in body) {
      const v = body.ogCoverPages;
      if (v === null || v === undefined || v === "") {
        data.ogCoverPages = null;
      } else {
        const n = typeof v === "string" ? parseInt(v, 10) : v;
        if (!Number.isInteger(n) || n < 1 || n > 3) {
          return NextResponse.json(
            { error: "Invalid ogCoverPages: must be 1, 2, 3 or null" },
            { status: 400 }
          );
        }
        data.ogCoverPages = n;
      }
    }
    // OG language override: null/"" = inherit global, otherwise "fr" | "ar"
    if ("ogLang" in body) {
      const v = body.ogLang;
      if (v === null || v === undefined || v === "") {
        data.ogLang = null;
      } else if (v === "fr" || v === "ar") {
        data.ogLang = v;
      } else {
        return NextResponse.json(
          { error: 'Invalid ogLang: must be "fr", "ar" or null' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const oldCatalogue = await prisma.catalogue.findUnique({
      where: { id },
      select: { status: true, slug: true },
    });

    const updated = await prisma.catalogue.update({
      where: { id },
      data,
    });

    if (data.status === "PUBLISHED" && oldCatalogue?.status !== "PUBLISHED") {
      publishCatalogue(updated.slug).catch((err) => {
        console.error("Failed to publish catalogue to Google:", err);
      });
    } else if (updated.status === "PUBLISHED") {
      // Edit of a live catalogue: refresh its page + lists (no Google ping).
      revalidateCatalogue(updated.slug);
    } else {
      revalidateSite();
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating catalogue:", error);
    return NextResponse.json(
      { error: "Failed to update catalogue" },
      { status: 500 }
    );
  }
}