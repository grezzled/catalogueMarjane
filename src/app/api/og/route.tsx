import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { formatDateRange } from "@/lib/utils";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

export const runtime = "nodejs";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const BANNER_HEIGHT = 140;

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "NotoSansArabic-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "NotoSansArabic-Bold.ttf");

let fontRegularCache: Buffer | null = null;
let fontBoldCache: Buffer | null = null;

async function getArabicFonts() {
  if (!fontRegularCache) fontRegularCache = await fs.readFile(FONT_REGULAR);
  if (!fontBoldCache) fontBoldCache = await fs.readFile(FONT_BOLD);
  return { regular: fontRegularCache, bold: fontBoldCache };
}

async function getOGSettings() {
  let settings = await prisma.oGSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    settings = await prisma.oGSettings.create({
      data: {
        id: "singleton",
        bannerTitle: "Catalogue Marjane",
        bannerTitleAr: "كتالوج مرجان",
        bannerSubtitle: "Promotions et Offres",
        bannerSubtitleAr: "عروض وتوصيل",
        bodyText: "Promotions et Offres au Maroc",
        bodyTextAr: "عروض وتوصيل في المغرب",
        coverPages: 1,
        defaultLang: "fr",
      },
    });
  }
  return settings;
}

type GlobalOgSettings = Awaited<ReturnType<typeof getOGSettings>>;

interface CatalogueOgOverride {
  ogBannerTitle: string | null;
  ogBannerTitleAr: string | null;
  ogBannerSubtitle: string | null;
  ogBannerSubtitleAr: string | null;
  ogBodyText: string | null;
  ogBodyTextAr: string | null;
  ogCoverPages: number | null;
  ogLang: string | null;
}

type OgLang = "fr" | "ar";

function normalizeOgLang(value: unknown): OgLang | null {
  return value === "fr" || value === "ar" ? value : null;
}

/** Priority: explicit ?lang= param > per-catalogue override > global default. */
function resolveIsArabic(
  langParam: unknown,
  catalogueOgLang: unknown,
  globalDefaultLang: unknown
): boolean {
  return (
    normalizeOgLang(langParam) ??
    normalizeOgLang(catalogueOgLang) ??
    normalizeOgLang(globalDefaultLang) ??
    "fr"
  ) === "ar";
}

function pickOverride(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : value;
}

/** Global settings with per-catalogue overrides applied (null/empty = inherit global). */
function resolveOgSettings(
  global: GlobalOgSettings,
  override: CatalogueOgOverride | null | undefined
): GlobalOgSettings {
  if (!override) return global;
  const coverPages =
    typeof override.ogCoverPages === "number" &&
    Number.isInteger(override.ogCoverPages)
      ? Math.min(3, Math.max(1, override.ogCoverPages))
      : global.coverPages;
  return {
    ...global,
    bannerTitle: pickOverride(override.ogBannerTitle) ?? global.bannerTitle,
    bannerTitleAr: pickOverride(override.ogBannerTitleAr) ?? global.bannerTitleAr,
    bannerSubtitle: pickOverride(override.ogBannerSubtitle) ?? global.bannerSubtitle,
    bannerSubtitleAr: pickOverride(override.ogBannerSubtitleAr) ?? global.bannerSubtitleAr,
    bodyText: pickOverride(override.ogBodyText) ?? global.bodyText,
    bodyTextAr: pickOverride(override.ogBodyTextAr) ?? global.bodyTextAr,
    coverPages,
  };
}

const CATALOGUE_OG_SELECT = {
  id: true,
  store: true,
  startDate: true,
  endDate: true,
  status: true,
  ogBannerTitle: true,
  ogBannerTitleAr: true,
  ogBannerSubtitle: true,
  ogBannerSubtitleAr: true,
  ogBodyText: true,
  ogBodyTextAr: true,
  ogCoverPages: true,
  ogLang: true,
} as const;

const COVER_HEIGHT = OG_HEIGHT - BANNER_HEIGHT;

async function loadCoverTile(imagePath: string | null, width: number): Promise<Buffer | null> {
  if (!imagePath) return null;
  try {
    await fs.access(imagePath);
    const buffer = await fs.readFile(imagePath);
    return await sharp(buffer)
      .resize(width, COVER_HEIGHT, { fit: "cover", position: "centre" })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Join the first N catalogue pages side-by-side into one 1200x490 cover.
 * Returns a data URI, or null when no page image is available.
 */
async function buildCoverImage(
  imagePaths: Array<string | null>,
  requested: number
): Promise<string | null> {
  const count = Math.min(3, Math.max(1, Math.floor(requested) || 1));
  const available = imagePaths.filter((p): p is string => !!p).slice(0, count);
  if (available.length === 0) return null;
  const tileWidth = Math.floor(OG_WIDTH / available.length);
  const tiles: Buffer[] = [];
  for (const p of available) {
    const tile = await loadCoverTile(p, tileWidth);
    if (tile) tiles.push(tile);
  }
  if (tiles.length === 0) return null;
  // Re-distribute width if some tiles failed to load
  const finalWidth = Math.floor(OG_WIDTH / tiles.length);
  const resized = await Promise.all(
    tiles.map((t) =>
      sharp(t)
        .resize(finalWidth, COVER_HEIGHT, { fit: "cover", position: "centre" })
        .toBuffer()
    )
  );
  const canvas = sharp({
    create: {
      width: OG_WIDTH,
      height: COVER_HEIGHT,
      channels: 3,
      background: "#1e3a5f",
    },
  }).composite(
    resized.map((input, i) => ({ input, left: i * finalWidth, top: 0 }))
  );
  const png = await canvas.png({ quality: 90 }).toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function renderArabicBanner(
  title: string,
  subtitle: string,
  dates: string
): Promise<string> {
  const { regular, bold } = await getArabicFonts();
  const regularB64 = regular.toString("base64");
  const boldB64 = bold.toString("base64");

  const subtitleText = `${subtitle} ${dates}`;

  const svg = `
    <svg width="${OG_WIDTH}" height="${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face { font-family: 'Ar'; src: url('data:font/ttf;base64,${regularB64}'); font-weight: 400; }
          @font-face { font-family: 'Ar'; src: url('data:font/ttf;base64,${boldB64}'); font-weight: 700; }
          @font-face { font-family: 'Ar'; src: url('data:font/ttf;base64,${boldB64}'); font-weight: 900; }
        </style>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#dc2626"/>
          <stop offset="100%" stop-color="#ef4444"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#bg)"/>
      <text x="${OG_WIDTH / 2}" y="60" text-anchor="middle" font-family="Ar" font-weight="900" font-size="42" fill="#facc15" direction="rtl">${title}</text>
      <text x="${OG_WIDTH / 2}" y="100" text-anchor="middle" font-family="Ar" font-weight="700" font-size="26" fill="white" direction="rtl">${subtitleText}</text>
    </svg>
  `;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function renderFrenchBanner(
  title: string,
  subtitle: string,
  dates: string
): Promise<string> {
  const subtitleText = `${subtitle} ${dates}`;

  const svg = `
    <svg width="${OG_WIDTH}" height="${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#dc2626"/>
          <stop offset="100%" stop-color="#ef4444"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#bg)"/>
      <text x="${OG_WIDTH / 2}" y="60" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="42" fill="#facc15">${title}</text>
      <text x="${OG_WIDTH / 2}" y="100" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="26" fill="white">${subtitleText}</text>
    </svg>
  `;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function makeFallbackBody(text: string) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e3a5f, #2563eb, #3b82f6)",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 32,
          fontWeight: 600,
          color: "rgba(255,255,255,0.9)",
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
}

async function buildBanner(
  settings: { bannerTitle: string; bannerTitleAr: string; bannerSubtitle: string; bannerSubtitleAr: string },
  isArabic: boolean,
  dates: string
): Promise<string> {
  if (isArabic) {
    return renderArabicBanner(settings.bannerTitleAr, settings.bannerSubtitleAr, dates);
  }
  return renderFrenchBanner(settings.bannerTitle, settings.bannerSubtitle, dates);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const type = searchParams.get("type") || "default";
  const langParam = normalizeOgLang(searchParams.get("lang"));

  const settings = await getOGSettings();
  let isArabic = resolveIsArabic(langParam, null, settings.defaultLang);

  const imageOpts = {
    width: OG_WIDTH,
    height: OG_HEIGHT,
  };

  // --- Catalogue OG ---
  if (type === "catalogue" && slug) {
    const catalogue = await prisma.catalogue.findUnique({
      where: { slug },
      select: CATALOGUE_OG_SELECT,
    });

    if (!catalogue || catalogue.status !== "PUBLISHED") {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
            }}
          >
            <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "white" }}>
              {settings.bannerTitle}
            </div>
          </div>
        ),
        imageOpts
      );
    }

    const dates = formatDateRange(catalogue.startDate, catalogue.endDate);
    const effective = resolveOgSettings(settings, catalogue);
    isArabic = resolveIsArabic(langParam, catalogue.ogLang, settings.defaultLang);
    const bannerDataUri = await buildBanner(effective, isArabic, dates);

    const coverPages = await prisma.cataloguePage.findMany({
      where: { catalogueId: catalogue.id },
      orderBy: { pageNumber: "asc" },
      take: effective.coverPages,
      select: { imagePath: true },
    });
    const bodyImage = await buildCoverImage(
      coverPages.map((p) => p.imagePath),
      effective.coverPages
    );

    const effectiveBodyText = isArabic ? effective.bodyTextAr : effective.bodyText;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <img src={bannerDataUri} style={{ width: "100%", height: BANNER_HEIGHT }} />
          {bodyImage ? (
            <div style={{ flex: 1, display: "flex", width: "100%" }}>
              <img src={bodyImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            makeFallbackBody(effectiveBodyText)
          )}
        </div>
      ),
      imageOpts
    );
  }

  // --- Page OG (removed with the standalone /page/N routes, which now
  // 301-redirect to the catalogue anchor) ---

  // --- Article OG ---
  if (type === "article" && slug) {
    const article = await prisma.article.findUnique({
      where: { slug },
      select: { catalogueId: true },
    });

    if (!article?.catalogueId) {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
            }}
          >
            <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "white" }}>
              {settings.bannerTitle}
            </div>
          </div>
        ),
        imageOpts
      );
    }

    const catalogue = await prisma.catalogue.findUnique({
      where: { id: article.catalogueId },
      select: CATALOGUE_OG_SELECT,
    });

    if (!catalogue) {
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#1d4ed8",
            }}
          >
            <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "white" }}>
              {settings.bannerTitle}
            </div>
          </div>
        ),
        imageOpts
      );
    }

    const dates = formatDateRange(catalogue.startDate, catalogue.endDate);
    const effective = resolveOgSettings(settings, catalogue);
    isArabic = resolveIsArabic(langParam, catalogue.ogLang, settings.defaultLang);
    const bannerDataUri = await buildBanner(effective, isArabic, dates);

    const coverPages = await prisma.cataloguePage.findMany({
      where: { catalogueId: article.catalogueId },
      orderBy: { pageNumber: "asc" },
      take: effective.coverPages,
      select: { imagePath: true },
    });
    const bodyImage = await buildCoverImage(
      coverPages.map((p) => p.imagePath),
      effective.coverPages
    );

    const effectiveBodyText = isArabic ? effective.bodyTextAr : effective.bodyText;

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <img src={bannerDataUri} style={{ width: "100%", height: BANNER_HEIGHT }} />
          {bodyImage ? (
            <div style={{ flex: 1, display: "flex", width: "100%" }}>
              <img src={bodyImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ) : (
            makeFallbackBody(effectiveBodyText)
          )}
        </div>
      ),
      imageOpts
    );
  }

  // --- Default OG image (respects global default language) ---
  const defaultTitle = isArabic ? settings.bannerTitleAr : settings.bannerTitle;
  const defaultBody = isArabic ? settings.bodyTextAr : settings.bodyText;
  const defaultBannerSvg = `
    <svg width="${OG_WIDTH}" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1d4ed8"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="200" fill="url(#bg)"/>
      <text x="${OG_WIDTH / 2}" y="90" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="800" font-size="56" fill="white">${defaultTitle}</text>
      <text x="${OG_WIDTH / 2}" y="140" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="400" font-size="28" fill="rgba(255,255,255,0.85)">${defaultBody}</text>
    </svg>
  `;
  const defaultBannerPng = await sharp(Buffer.from(defaultBannerSvg)).png().toBuffer();
  const defaultBannerDataUri = `data:image/png;base64,${defaultBannerPng.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <img src={defaultBannerDataUri} style={{ width: "100%", height: "100%" }} />
      </div>
    ),
    imageOpts
  );
}
