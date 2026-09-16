import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateSite } from "@/lib/revalidate";

export const runtime = "nodejs";

const DEFAULT_SETTINGS = {
  id: "singleton",
  bannerTitle: "Catalogue Marjane",
  bannerTitleAr: "كتالوج مرجان",
  bannerSubtitle: "Promotions et Offres",
  bannerSubtitleAr: "عروض وتوصيل",
  bodyText: "Promotions et Offres au Maroc",
  bodyTextAr: "عروض وتوصيل في المغرب",
  coverPages: 1,
  defaultLang: "fr",
};

function sanitizeCoverPages(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 3) return undefined;
  return n as number;
}

function sanitizeDefaultLang(value: unknown): string | undefined {
  if (value === "fr" || value === "ar") return value;
  return undefined;
}

export async function GET() {
  let settings = await prisma.oGSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.oGSettings.create({
      data: DEFAULT_SETTINGS,
    });
  }

  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const coverPages = sanitizeCoverPages(body.coverPages);
  const defaultLang = sanitizeDefaultLang(body.defaultLang);

  const settings = await prisma.oGSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      bannerTitle: body.bannerTitle ?? DEFAULT_SETTINGS.bannerTitle,
      bannerTitleAr: body.bannerTitleAr ?? DEFAULT_SETTINGS.bannerTitleAr,
      bannerSubtitle: body.bannerSubtitle ?? DEFAULT_SETTINGS.bannerSubtitle,
      bannerSubtitleAr: body.bannerSubtitleAr ?? DEFAULT_SETTINGS.bannerSubtitleAr,
      bodyText: body.bodyText ?? DEFAULT_SETTINGS.bodyText,
      bodyTextAr: body.bodyTextAr ?? DEFAULT_SETTINGS.bodyTextAr,
      coverPages: coverPages ?? DEFAULT_SETTINGS.coverPages,
      defaultLang: defaultLang ?? "fr",
    },
    update: {
      bannerTitle: body.bannerTitle,
      bannerTitleAr: body.bannerTitleAr,
      bannerSubtitle: body.bannerSubtitle,
      bannerSubtitleAr: body.bannerSubtitleAr,
      bodyText: body.bodyText,
      bodyTextAr: body.bodyTextAr,
      ...(coverPages !== undefined ? { coverPages } : {}),
      ...(defaultLang !== undefined ? { defaultLang } : {}),
    },
  });

  // OG images are referenced by page metadata — refresh listings promptly.
  revalidateSite();

  return NextResponse.json(settings);
}
