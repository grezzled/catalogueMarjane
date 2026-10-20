import { prisma } from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { shouldUsePaidKey } from "@/services/ai-settings";
import { extractJsonFromAIResponse } from "@/lib/utils";
import { priceVariants } from "@/services/articles";

export interface EditorialPick {
  productId: string;
  name: string;
  slug: string | null;
  salePrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  reason: string;
}

export interface EditorialChecks {
  priceScore: number;
  checkedProducts: number;
  attempts: number;
  fallback: boolean;
  wordCount: number;
  issues: string[];
}

export interface EditorialResult {
  success: boolean;
  text?: string;
  picks?: EditorialPick[];
  tip?: string;
  error?: string;
  checks?: EditorialChecks;
}

interface PageRow {
  id: string;
  pageNumber: number;
  editorialTitle: string | null;
  editorialSummary: string | null;
}

interface OfferRow {
  id: string;
  productId: string;
  salePrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  cataloguePageId: string;
  product: {
    name: string;
    brand: string | null;
    category: string;
    slug: string | null;
    specifications: string | null;
  };
}

interface DealFact {
  productId: string;
  name: string;
  slug: string | null;
  category: string;
  page: number | null;
  salePrice: number | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
}

interface PreviousPriceFact {
  productId: string;
  name: string;
  currentPrice: number | null;
  previousPrice: number | null;
  previousCatalogue: string;
  previousEndDate: Date;
}

interface EditorialFacts {
  title: string;
  store: string;
  startDate: Date;
  endDate: Date;
  pages: number;
  offers: number;
  products: number;
  biggestDiscount: DealFact | null;
  categories: { name: string; offers: number; maxDiscount: number }[];
  topDeals: DealFact[];
  cheapest: DealFact[];
  candidates: DealFact[];
  previousPrices: PreviousPriceFact[];
  brackets: { under50: number; between50and200: number; over200: number };
}

const FORMULA_PHRASES = [
  "complètent cette page",
  "ne manquez pas",
  "il y en a pour tous les goûts",
  "faites le plein",
  "à ne pas manquer",
  "pour tous les budgets",
];

const STYLE_VARIANTS = [
  "Commence par une question courte et concrète sur les achats de la semaine.",
  "Commence par la période de validité, puis enchaîne sur les rayons les plus fournis.",
  "Commence par le rayon qui concentre le plus d'offres, sans formule d'accroche.",
  "Commence par une observation factuelle sur les prix les plus bas du catalogue.",
  "Commence par la remise la plus forte, en la replaçant dans son rayon.",
  "Commence par une phrase courte sur l'étendue du catalogue, puis cite deux rayons.",
];

const MOIS_FR = [
  "janvier",
  "février",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
  "decembre",
];


const AI_ATTEMPT_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtPrice(p: number | null): string {
  return p == null ? "—" : `${p.toLocaleString("fr-FR")} DH`;
}

function normName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function pageNumberFor(offer: OfferRow, pages: PageRow[]): number | null {
  return pages.find((p) => p.id === offer.cataloguePageId)?.pageNumber ?? null;
}

function toDeal(offer: OfferRow, pages: PageRow[]): DealFact {
  return {
    productId: offer.productId,
    name: offer.product.name,
    slug: offer.product.slug,
    category: offer.product.category || "Autres",
    page: pageNumberFor(offer, pages),
    salePrice: offer.salePrice,
    originalPrice: offer.originalPrice,
    discountPercentage: offer.discountPercentage,
    discountAmount: offer.discountAmount,
  };
}

function uniqueDeals(deals: DealFact[], limit: number): DealFact[] {
  const seen = new Set<string>();
  const out: DealFact[] = [];
  for (const deal of deals) {
    if (seen.has(deal.productId)) continue;
    seen.add(deal.productId);
    out.push(deal);
    if (out.length >= limit) break;
  }
  return out;
}

async function computeFacts(
  catalogueId: string,
  catalogue: {
    title: string;
    store: string;
    startDate: Date;
    endDate: Date;
    pageCount: number;
  },
  pages: PageRow[],
  offers: OfferRow[]
): Promise<EditorialFacts> {
  const products = new Set(offers.map((o) => o.productId));
  const catMap = new Map<string, { offers: number; maxDiscount: number }>();
  for (const offer of offers) {
    const name = offer.product.category?.trim() || "Autres";
    const entry = catMap.get(name) ?? { offers: 0, maxDiscount: 0 };
    entry.offers += 1;
    entry.maxDiscount = Math.max(entry.maxDiscount, offer.discountPercentage ?? 0);
    catMap.set(name, entry);
  }
  const categories = [...catMap.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.offers - a.offers)
    .slice(0, 8);

  const allDeals = offers.map((o) => toDeal(o, pages));
  const topDeals = uniqueDeals(
    [...allDeals].sort((a, b) => (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0)),
    5
  );
  const cheapest = uniqueDeals(
    [...allDeals]
      .filter((d) => d.salePrice != null)
      .sort((a, b) => (a.salePrice ?? Infinity) - (b.salePrice ?? Infinity)),
    5
  );
  const candidates = uniqueDeals([...topDeals, ...cheapest], 10);

  const withPrice = allDeals.filter((d) => d.salePrice != null);
  const brackets = {
    under50: withPrice.filter((d) => (d.salePrice ?? 0) < 50).length,
    between50and200: withPrice.filter(
      (d) => (d.salePrice ?? 0) >= 50 && (d.salePrice ?? 0) <= 200
    ).length,
    over200: withPrice.filter((d) => (d.salePrice ?? 0) > 200).length,
  };

  const previousOffers = await prisma.offer.findMany({
    where: {
      productId: { in: [...products] },
      catalogueId: { not: catalogueId },
      catalogue: { endDate: { lt: catalogue.startDate } },
    },
    orderBy: { endDate: "desc" },
    select: {
      productId: true,
      salePrice: true,
      endDate: true,
      product: { select: { name: true } },
      catalogue: { select: { title: true } },
    },
  });
  const previousByProduct = new Map<string, (typeof previousOffers)[number]>();
  for (const previous of previousOffers) {
    if (!previousByProduct.has(previous.productId)) {
      previousByProduct.set(previous.productId, previous);
    }
  }
  const currentPriceByProduct = new Map(
    allDeals.map((d) => [d.productId, d.salePrice] as const)
  );
  const previousPrices: PreviousPriceFact[] = [];
  for (const [productId, previous] of previousByProduct) {
    previousPrices.push({
      productId,
      name: previous.product.name,
      currentPrice: currentPriceByProduct.get(productId) ?? null,
      previousPrice: previous.salePrice,
      previousCatalogue: previous.catalogue.title,
      previousEndDate: previous.endDate,
    });
  }

  const biggestDiscount = [...allDeals]
    .filter((d) => (d.discountPercentage ?? 0) > 0)
    .sort((a, b) => (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0))[0] ?? null;

  return {
    title: catalogue.title,
    store: catalogue.store,
    startDate: catalogue.startDate,
    endDate: catalogue.endDate,
    pages: catalogue.pageCount,
    offers: offers.length,
    products: products.size,
    biggestDiscount,
    categories,
    topDeals,
    cheapest,
    candidates,
    previousPrices: previousPrices.slice(0, 15),
    brackets,
  };
}

function buildFactsText(facts: EditorialFacts): string {
  const lines = [
    `TITRE: ${facts.title}`,
    `MAGASIN: ${facts.store === "marjane_market" ? "Marjane Market" : facts.store === "marjane_hyper" ? "Marjane Hyper" : "Marjane"}`,
    `VALIDITÉ: du ${frDate(facts.startDate)} au ${frDate(facts.endDate)} (dates en français, jamais au format ISO)`,
    `PAGES: ${facts.pages}`,
    `OFFRES: ${facts.offers}`,
    `PRODUITS DIFFÉRENTS: ${facts.products}`,
    `PLUS FORTE REMISE: ${facts.biggestDiscount ? `${facts.biggestDiscount.name} (-${Math.round(facts.biggestDiscount.discountPercentage ?? 0)}%, ${fmtPrice(facts.biggestDiscount.salePrice)})` : "aucune remise en pourcentage"}`,
    `RAYONS: ${facts.categories.map((c) => `${c.name} (${c.offers} offres, max -${Math.round(c.maxDiscount)}%)`).join(" ; ") || "—"}`,
    `PRIX: moins de 50 DH = ${facts.brackets.under50} offres ; de 50 à 200 DH = ${facts.brackets.between50and200} offres ; plus de 200 DH = ${facts.brackets.over200} offres`,
    `TOP 5 REMISES:`,
    ...facts.topDeals.map(
      (d) =>
        `- ${d.name} | ${fmtPrice(d.originalPrice)} → ${fmtPrice(d.salePrice)}${d.discountPercentage != null ? ` (-${Math.round(d.discountPercentage)}%)` : ""} | ${d.category}${d.page != null ? ` | page ${d.page}` : ""}`
    ),
    `OFFRES LES MOINS CHÈRES:`,
    ...facts.cheapest.map(
      (d) =>
        `- ${d.name} | ${fmtPrice(d.salePrice)}${d.originalPrice != null ? ` (au lieu de ${fmtPrice(d.originalPrice)})` : ""} | ${d.category}`
    ),
    `SÉLECTION CANDIDATE — choisis 3 à 5 produits UNIQUEMENT dans cette liste:`,
    ...facts.candidates.map(
      (d) =>
        `- ${d.name} | ${fmtPrice(d.originalPrice)} → ${fmtPrice(d.salePrice)}${d.discountPercentage != null ? ` (-${Math.round(d.discountPercentage)}%)` : ""} | ${d.category}${d.page != null ? ` | page ${d.page}` : ""}`
    ),
    `PRODUITS DÉJÀ VUS DANS UN CATALOGUE PRÉCÉDENT:`,
    ...(facts.previousPrices.length > 0
      ? facts.previousPrices.map(
          (p) =>
            `- ${p.name} | prix actuel ${fmtPrice(p.currentPrice)} | prix précédent ${fmtPrice(p.previousPrice)} | ${p.previousCatalogue} (fin ${frDate(p.previousEndDate)})`
        )
      : ["- aucun"]),
  ];
  return lines.join("\n");
}

function factNumbers(facts: EditorialFacts): number[] {
  const out: number[] = [
    facts.offers,
    facts.products,
    facts.pages,
    facts.brackets.under50,
    facts.brackets.between50and200,
    facts.brackets.over200,
    50,
    200,
    facts.startDate.getFullYear(),
    facts.startDate.getDate(),
    facts.startDate.getMonth() + 1,
    facts.endDate.getFullYear(),
    facts.endDate.getDate(),
    facts.endDate.getMonth() + 1,
  ];
  for (const c of facts.categories) {
    out.push(c.offers, c.maxDiscount, Math.round(c.maxDiscount));
  }
  for (const deal of [...facts.topDeals, ...facts.cheapest, ...facts.candidates]) {
    for (const n of [deal.salePrice, deal.originalPrice, deal.discountPercentage, deal.discountAmount, deal.page]) {
      if (n != null) out.push(n);
    }
    if (deal.discountPercentage != null) out.push(Math.round(deal.discountPercentage));
  }
  for (const p of facts.previousPrices) {
    for (const n of [p.currentPrice, p.previousPrice]) {
      if (n != null) out.push(n);
    }
  }
  return out;
}

function extractAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.match(/\d[\d\s]*(?:[.,]\d+)?/g) ?? []) {
    let normalized = m.replace(/\s/g, "");
    if (normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    }
    const value = parseFloat(normalized);
    if (Number.isNaN(value)) continue;
    if (!normalized.includes(".") && Number.isInteger(value) && value < 13) continue;
    out.push(value);
  }
  return out;
}

function scrubNames(text: string, facts: EditorialFacts): string {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let scrubbed = text;
  const names = new Set<string>();
  for (const deal of [...facts.topDeals, ...facts.cheapest, ...facts.candidates]) {
    if (deal.name) names.add(deal.name);
  }
  for (const p of facts.previousPrices) names.add(p.name);
  for (const name of names) {
    if (name.trim().length >= 3) {
      scrubbed = scrubbed.replace(new RegExp(escape(name.trim()), "gi"), " ");
    }
  }
  return scrubbed;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function openingKey(text: string): string {
  return normName(text).split(" ").slice(0, 5).join(" ");
}

function closingKey(text: string): string {
  return normName(text).split(" ").slice(-6).join(" ");
}

function priceFieldsForDeal(deal: DealFact): number[] {
  return [deal.salePrice, deal.originalPrice, deal.discountPercentage, deal.discountAmount]
    .filter((n): n is number => n != null);
}

function verifyMentionedProductPrices(
  text: string,
  offers: OfferRow[]
): { checked: number; matched: number; score: number } {
  const lower = text.toLowerCase();
  const normalizedText = normName(text);
  const groups = new Map<string, { prices: (number | null)[] }>();
  for (const offer of offers) {
    const key = normName(offer.product.name);
    if (!key) continue;
    const group = groups.get(key) ?? { prices: [] };
    group.prices.push(offer.salePrice);
    groups.set(key, group);
  }
  let checked = 0;
  let matched = 0;
  for (const [key, group] of groups) {
    if (!normalizedText.includes(key)) continue;
    checked += 1;
    const ok = group.prices.some(
      (price) =>
        price == null || priceVariants(price).some((variant) => lower.includes(variant.toLowerCase()))
    );
    if (ok) matched += 1;
  }
  return {
    checked,
    matched,
    score: checked === 0 ? -1 : Math.round((matched / checked) * 100),
  };
}

interface ParsedEditorial {
  intro: string;
  picks: { productName: string; reason: string }[];
  tip: string;
}

function parseEditorial(raw: unknown): ParsedEditorial | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const intro = typeof obj.intro === "string" ? obj.intro.trim() : "";
  const tip = typeof obj.tip === "string" ? obj.tip.trim() : "";
  const rawPicks = Array.isArray(obj.picks) ? obj.picks : [];
  const picks = rawPicks
    .map((pick) => {
      if (!pick || typeof pick !== "object") return null;
      const p = pick as Record<string, unknown>;
      const productName = typeof p.productName === "string" ? p.productName.trim() : "";
      const reason = typeof p.reason === "string" ? p.reason.trim() : "";
      if (!productName || !reason) return null;
      return { productName, reason };
    })
    .filter((p): p is { productName: string; reason: string } => p !== null);
  if (!intro || !tip || picks.length === 0) return null;
  return { intro, picks, tip };
}

function validateEditorial(
  parsed: ParsedEditorial,
  facts: EditorialFacts,
  offers: OfferRow[],
  recent: { description: string | null }[]
): string[] {
  const issues: string[] = [];
  const introSentences = sentences(parsed.intro);
  if (introSentences.length < 2 || introSentences.length > 3) {
    issues.push(`intro-sentences(${introSentences.length})`);
  }
  if (parsed.picks.length < 3 || parsed.picks.length > 5) {
    issues.push(`picks-count(${parsed.picks.length})`);
  }

  const combined = [parsed.intro, parsed.tip, ...parsed.picks.map((p) => p.reason)].join("\n");
  const lowerCombined = combined.toLowerCase();
  for (const phrase of FORMULA_PHRASES) {
    if (lowerCombined.includes(phrase)) issues.push(`formula(${phrase})`);
  }

  const allowedMonths = new Set(
    [facts.startDate, facts.endDate].map((d) => normName(d.toLocaleDateString("fr-FR", { month: "long" })))
  );
  const normalizedCombined = normName(combined);
  for (const month of MOIS_FR) {
    const normalizedMonth = normName(month);
    if (!new RegExp(`(?:^| )${normalizedMonth}(?: |$)`).test(normalizedCombined)) continue;
    if (!allowedMonths.has(normalizedMonth)) {
      issues.push(`month(${month})`);
    }
  }

  const allowedNumbers = factNumbers(facts);
  const unknown = extractAmounts(scrubNames(combined, facts)).filter(
    (n) => !allowedNumbers.some((a) => Math.abs(n - a) < 0.005)
  );
  if (unknown.length > 0) {
    issues.push(`unknown-numbers(${unknown.slice(0, 5).join(",")})`);
  }

  const priceCheck = verifyMentionedProductPrices(parsed.intro, offers);
  if (priceCheck.checked < 1 || priceCheck.score !== 100) {
    issues.push(`intro-price-check(checked=${priceCheck.checked},score=${priceCheck.score})`);
  }

  const candidateByKey = new Map(
    facts.candidates.map((deal) => [normName(deal.name), deal] as const)
  );
  const pickKeys = new Set<string>();
  for (const pick of parsed.picks) {
    const key = normName(pick.productName);
    const deal = candidateByKey.get(key);
    if (!deal) {
      issues.push(`pick-unknown(${pick.productName})`);
      continue;
    }
    if (pickKeys.has(deal.productId)) {
      issues.push(`pick-duplicate(${pick.productName})`);
    }
    pickKeys.add(deal.productId);
    const reasonAmounts = extractAmounts(scrubNames(pick.reason, facts));
    if (reasonAmounts.length > 0 && !reasonAmounts.some((n) => priceFieldsForDeal(deal).some((a) => Math.abs(n - a) < 0.005))) {
      issues.push(`pick-price(${pick.productName})`);
    }
  }

  for (const recentCatalogue of recent) {
    if (!recentCatalogue.description) continue;
    if (openingKey(parsed.intro) === openingKey(recentCatalogue.description)) {
      issues.push("recent-opening");
    }
    if (closingKey(parsed.intro) === closingKey(recentCatalogue.description)) {
      issues.push("recent-closing");
    }
  }

  return [...new Set(issues)];
}

function pickFromDeal(deal: DealFact, reason: string): EditorialPick {
  return {
    productId: deal.productId,
    name: deal.name,
    slug: deal.slug,
    salePrice: deal.salePrice,
    originalPrice: deal.originalPrice,
    discountPercentage: deal.discountPercentage,
    reason,
  };
}

function buildPicks(parsed: ParsedEditorial, facts: EditorialFacts): EditorialPick[] {
  const candidateByKey = new Map(
    facts.candidates.map((deal) => [normName(deal.name), deal] as const)
  );
  return parsed.picks
    .map((pick) => {
      const deal = candidateByKey.get(normName(pick.productName));
      return deal ? pickFromDeal(deal, pick.reason) : null;
    })
    .filter((p): p is EditorialPick => p !== null);
}

function fallbackReason(deal: DealFact): string {
  if (deal.salePrice != null && deal.originalPrice != null && deal.originalPrice > deal.salePrice) {
    return `${deal.name} passe de ${fmtPrice(deal.originalPrice)} à ${fmtPrice(deal.salePrice)}.`;
  }
  if (deal.salePrice != null) {
    return `${deal.name} est proposé à ${fmtPrice(deal.salePrice)}.`;
  }
  return `${deal.name} figure parmi les offres de ce catalogue.`;
}

function buildFallback(facts: EditorialFacts): {
  intro: string;
  picks: EditorialPick[];
  tip: string;
} {
  const dates = `du ${frDate(facts.startDate)} au ${frDate(facts.endDate)}`;
  const mainCategories = facts.categories.slice(0, 3).map((c) => c.name);
  const sentences = [
    `Le catalogue « ${facts.title} » est valable ${dates}.`,
    `Il réunit ${facts.offers} offres sur ${facts.products} produits${facts.biggestDiscount && (facts.biggestDiscount.discountPercentage ?? 0) > 0 ? `, avec une remise maximale de ${Math.round(facts.biggestDiscount.discountPercentage ?? 0)} % sur ${facts.biggestDiscount.name}${facts.biggestDiscount.salePrice != null ? `, proposé à ${fmtPrice(facts.biggestDiscount.salePrice)}` : ""}` : ""}.`,
    mainCategories.length > 0
      ? `Les rayons les plus représentés sont ${mainCategories.join(", ")}.`
      : `Les offres couvrent plusieurs rayons du magasin.`,
  ];
  const intro = sentences.join(" ");
  const picks = facts.candidates.slice(0, 4).map((deal) => pickFromDeal(deal, fallbackReason(deal)));
  const mainCategory = facts.categories[0]?.name || "le rayon concerné";
  const tip = `Avant d'acheter dans ${mainCategory}, vérifiez les caractéristiques, la garantie et la date de fin de l'offre.`;
  return { intro, picks, tip };
}

function wordCountOf(
  intro: string,
  picks: EditorialPick[],
  tip: string,
  pages: PageRow[]
): number {
  return countWords(
    [
      intro,
      ...picks.map((p) => p.reason),
      tip,
      ...pages.map((p) => p.editorialSummary ?? ""),
    ].join(" ")
  );
}

/**
 * Generate the catalogue-level editorial layer from database facts only.
 * The AI writes intro + picks + tip; every number, date and pick is verified
 * against the computed facts. After two failed retries, a deterministic
 * template is saved instead of risky text.
 */
export async function generateEditorialForCatalogue(
  catalogueId: string
): Promise<EditorialResult> {
  const catalogue = await prisma.catalogue.findUnique({
    where: { id: catalogueId },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
        select: {
          id: true,
          pageNumber: true,
          editorialTitle: true,
          editorialSummary: true,
        },
      },
      offers: {
        include: {
          product: {
            select: {
              name: true,
              brand: true,
              category: true,
              slug: true,
              specifications: true,
            },
          },
        },
        orderBy: { discountPercentage: "desc" },
      },
    },
  });
  if (!catalogue) return { success: false, error: "Catalogue not found" };
  if (catalogue.offers.length === 0) {
    await prisma.catalogue.update({ where: { id: catalogueId }, data: { status: "REVIEW" } });
    return { success: false, error: "No offers to describe" };
  }

  await prisma.catalogue.update({
    where: { id: catalogueId },
    data: { status: "EDITORIAL" },
  });

  try {
    const facts = await computeFacts(
      catalogueId,
      {
        title: catalogue.title,
        store: catalogue.store,
        startDate: catalogue.startDate,
        endDate: catalogue.endDate,
        pageCount: catalogue.pageCount,
      },
      catalogue.pages,
      catalogue.offers as OfferRow[]
    );

    const recent = await prisma.catalogue.findMany({
      where: {
        id: { not: catalogueId },
        description: { not: null },
        editorialGeneratedAt: { not: null },
      },
      orderBy: { editorialGeneratedAt: "desc" },
      take: 5,
      select: { description: true },
    });

    const style = STYLE_VARIANTS[
      [...catalogueId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % STYLE_VARIANTS.length
    ];
    const recentOpenings = recent
      .map((c) => c.description)
      .filter((d): d is string => !!d)
      .map((d) => sentences(d)[0])
      .filter(Boolean);
    const styleBlock = [
      `STYLE: ${style}`,
      recentOpenings.length > 0
        ? `N'UTILISE PAS CES OUVERTURES (mots différents) : ${recentOpenings.map((o) => `« ${o} »`).join(" ; ")}`
        : "",
      "Ne réutilise pas les mêmes ouvertures, transitions ou phrases de conclusion d'un catalogue à l'autre.",
    ]
      .filter(Boolean)
      .join("\n");

    const provider = await AIProviderFactory.create(
      process.env.AI_PROVIDER || "gemini",
      process.env as Record<string, string | undefined>,
      { usePaidKey: await shouldUsePaidKey() }
    );

    const factsText = buildFactsText(facts);
    const prompt = `Tu rédiges la couche éditoriale en français d'un catalogue promotionnel Marjane au Maroc.

RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les faits du bloc FAITS. Chaque nom de produit, prix, pourcentage, nombre et date que tu écris doit y figurer exactement.
- N'invente aucun produit, prix, date, magasin ou caractéristique. Aucune connaissance extérieure.
- N'utilise pas d'adjectifs marketing (incroyable, exceptionnel, meilleur, unique, fabuleux).
- Évite les formules comme « complètent cette page », « ne manquez pas », « il y en a pour tous les goûts ».
- Les picks doivent reprendre le nom EXACT d'un produit du bloc FAITS.
- L'intro doit citer au moins un produit du bloc FAITS avec son prix de vente exact, sans arrondi.

FORMAT — réponds uniquement avec ce JSON :
{
  "intro": "2 à 3 phrases sur la validité, le thème et les offres principales",
  "picks": [
    { "productName": "<nom exact du produit dans FAITS>", "reason": "<une phrase de raison>" }
  ],
  "tip": "<un court conseil d'achat pour le rayon principal>"
}

CONTRAINTES :
- 3 à 5 picks, produits différents, choisis uniquement dans SÉLECTION CANDIDATE.
- Une raison par pick, une seule phrase.
- L'intro ne dépasse pas 3 phrases.
- Le conseil d'achat tient en une phrase.

${styleBlock}

FAITS :
${factsText}`;

    let lastIssues: string[] = [];
    let fallback = false;
    let saved: { intro: string; picks: EditorialPick[]; tip: string } | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= 3; attempt++) {
      attempts = attempt;
      try {
        const response = await withTimeout(
          provider.generateText(
            attempt === 1
              ? prompt
              : `${prompt}\n\nRAPPEL STRICT : la tentative précédente a échoué (${lastIssues.join("; ")}). Corrige en ne citant que des éléments présents dans FAITS.`
          ),
          AI_ATTEMPT_TIMEOUT_MS,
          "editorial-ai-timeout"
        );
        const parsed = parseEditorial(extractJsonFromAIResponse(response));
        if (!parsed) {
          lastIssues = ["invalid-json-or-shape"];
          continue;
        }
        const issues = validateEditorial(parsed, facts, catalogue.offers as OfferRow[], recent);
        if (issues.length > 0) {
          lastIssues = issues;
          continue;
        }
        saved = { intro: parsed.intro, picks: buildPicks(parsed, facts), tip: parsed.tip };
        lastIssues = [];
        break;
      } catch (error) {
        lastIssues = [`ai-error(${error instanceof Error ? error.message : "unknown"})`];
      }
    }

    if (!saved) {
      fallback = true;
      saved = buildFallback(facts);
    }

    const wordCount = wordCountOf(saved.intro, saved.picks, saved.tip, catalogue.pages);
    const priceCheck = verifyMentionedProductPrices(saved.intro, catalogue.offers as OfferRow[]);
    const checks: EditorialChecks = {
      priceScore: priceCheck.score,
      checkedProducts: priceCheck.checked,
      attempts,
      fallback,
      wordCount,
      issues: lastIssues,
    };

    await prisma.catalogue.update({
      where: { id: catalogueId },
      data: {
        description: saved.intro,
        editorialPicks: JSON.stringify(saved.picks),
        editorialTip: saved.tip,
        editorialStatus: "Generated",
        editorialChecks: JSON.stringify(checks),
        editorialGeneratedAt: new Date(),
        editorialApprovedAt: null,
        status: "REVIEW",
      },
    });

    return {
      success: true,
      text: saved.intro,
      picks: saved.picks,
      tip: saved.tip,
      checks,
    };
  } catch (error) {
    await prisma.catalogue.update({
      where: { id: catalogueId },
      data: { status: "REVIEW" },
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Editorial generation failed",
    };
  }
}
