import { prisma } from "@/lib/prisma";
import { AIProviderFactory } from "@/ai";
import { priceVariants } from "@/services/articles";

export interface EditorialResult {
  success: boolean;
  text?: string;
  error?: string;
  checks?: { priceScore: number; checkedProducts: number };
}

const EDITORIAL_PROMPT = `Tu rédiges le texte de présentation d'un catalogue promotionnel Marjane Maroc, en français.

RÈGLES ABSOLUES (anti-hallucination) :
- N'utilise QUE les faits du bloc FAITS ci-dessous. Chaque nom de produit, prix, pourcentage, date et nombre que tu cites DOIT y figurer exactement.
- N'invente AUCUN produit, AUCUN prix, AUCUNE date, AUCUN magasin.
- N'ajoute aucun lien, aucun appel à l'action vers un site, aucun texte en anglais.
- Ne mentionne que 2 à 4 produits, toujours avec leur prix exact des FAITS.

FORMAT :
- Exactement 2 paragraphes de texte brut, séparés par une ligne vide.
- 120 à 180 mots au total. Ton chaleureux de prospectus, phrases variées.
- Paragraphe 1 : le catalogue (titre, validité, ampleur, rayons forts).
- Paragraphe 2 : 2 à 4 offres marquantes avec prix exacts.
- Réponds UNIQUEMENT avec les 2 paragraphes, sans titre ni guillemets.
`;

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function fmtPrice(p: number | null): string {
  return p == null ? "—" : `${p.toLocaleString("fr-FR")} DH`;
}

/** Short spec hints (weights, volumes) so the AI can use them factually. */
function specHints(specifications: string | null): string[] {
  if (!specifications) return [];
  try {
    const parsed: unknown = JSON.parse(specifications);
    const items = Array.isArray(parsed)
      ? parsed.map(String)
      : typeof parsed === "object" && parsed !== null
        ? Object.values(parsed).map(String)
        : [specifications];
    return items.map((s) => s.trim()).filter(Boolean).slice(0, 3);
  } catch {
    return specifications.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  }
}

/**
 * Name-grouped price check: offers sharing one normalized name are verified
 * together, so "Galaxy A17" can't false-match via "Galaxy A07", and a name
 * sold at several prices passes when ANY of its prices is shown.
 */
function verifyEditorialPrices(
  text: string,
  offers: { salePrice: number | null; product: { name: string } }[]
): { checked: number; matched: number; score: number } {
  const t = text.toLowerCase();
  const groups = new Map<string, { prices: (number | null)[] }>();
  for (const o of offers) {
    const norm = o.product.name.toLowerCase().replace(/\s+/g, " ").trim();
    const g = groups.get(norm) ?? { prices: [] };
    g.prices.push(o.salePrice);
    groups.set(norm, g);
  }
  let checked = 0;
  let matched = 0;
  for (const [norm, g] of groups) {
    // Strict full-name presence: token fragments ("Galaxy A07" matching an
    // "A17" row) must never count as a mention.
    if (!t.includes(norm)) continue;
    checked++;
    const ok = g.prices.some(
      (p) => p == null || priceVariants(p).some((v) => t.includes(v.toLowerCase()))
    );
    if (ok) matched++;
  }
  return { checked, matched, score: checked === 0 ? -1 : Math.round((matched / checked) * 100) };
}

function buildFacts(
  catalogue: { title: string; startDate: Date; endDate: Date },
  counts: { offers: number; products: number; pages: number },
  categories: { name: string; offers: number; maxDiscount: number }[],
  deals: {
    name: string;
    brand: string | null;
    originalPrice: number | null;
    salePrice: number | null;
    discount: number | null;
    category: string;
    page: number | null;
    specs: string[];
  }[]
): string {
  const lines = [
    `TITRE: ${catalogue.title}`,
    `VALIDITÉ: du ${frDate(catalogue.startDate)} au ${frDate(catalogue.endDate)} (écrire les dates en français, jamais au format 2026-08-25)`,
    `MAGASIN: Marjane Maroc`,
    `NOMBRE D'OFFRES: ${counts.offers}`,
    `NOMBRE DE PRODUITS: ${counts.products}`,
    `NOMBRE DE PAGES: ${counts.pages}`,
    `RAYONS: ${categories.map((c) => `${c.name} (${c.offers} offres, jusqu'à -${Math.round(c.maxDiscount)}%)`).join(" ; ") || "—"}`,
    `OFFRES (noms et prix exacts autorisés):`,
    ...deals.map(
      (d) =>
        `- ${d.name}${d.brand ? ` [${d.brand}]` : ""} | ${fmtPrice(d.originalPrice)} → ${fmtPrice(d.salePrice)}${d.discount != null ? ` (-${Math.round(d.discount)}%)` : ""} | ${d.category}${d.page != null ? ` | page ${d.page}` : ""}${d.specs.length > 0 ? ` | ${d.specs.join(" ; ")}` : ""}`
    ),
  ];
  return lines.join("\n");
}

/**
 * Numeric gate: parse every amount in the prose (French "1 490", "59,95" or
 * "59.95" all parse correctly) and require each one to exist in the facts.
 * Small integers (2+1, lot de 4…) are promo mechanics, not facts — skipped.
 */
function extractAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.match(/\d[\d\s]*(?:[.,]\d+)?/g) ?? []) {
    let norm = m.replace(/\s/g, "");
    if (norm.includes(",")) norm = norm.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(norm);
    if (Number.isNaN(v)) continue;
    if (!norm.includes(".") && Number.isInteger(v) && v < 13) continue;
    out.push(v);
  }
  return out;
}

function factAmounts(
  counts: { offers: number; products: number; pages: number },
  startDate: Date,
  endDate: Date,
  categories: { maxDiscount: number }[],
  deals: { originalPrice: number | null; salePrice: number | null; discount: number | null; page: number | null; specs: string[] }[],
  extra: number[]
): number[] {
  const out: number[] = [counts.offers, counts.products, counts.pages, ...extra];
  for (const d of [startDate, endDate]) {
    out.push(d.getFullYear(), d.getDate(), d.getMonth() + 1);
  }
  for (const c of categories) out.push(c.maxDiscount);
  const specNums = (s: string): number[] => {
    const nums: number[] = [];
    for (const m of s.match(/\d[\d\s]*(?:[.,]\d+)?/g) ?? []) {
      let norm = m.replace(/\s/g, "");
      if (norm.includes(",")) norm = norm.replace(/\./g, "").replace(",", ".");
      const v = parseFloat(norm);
      if (!Number.isNaN(v)) nums.push(v);
    }
    return nums;
  };
  for (const deal of deals) {
    for (const n of [deal.originalPrice, deal.salePrice, deal.discount, deal.page]) {
      if (n != null) out.push(n);
    }
    for (const s of deal.specs) out.push(...specNums(s));
  }
  return out;
}

/**
 * Generate a unique French editorial intro for a catalogue, grounded
 * exclusively in database facts. The text is verified before saving:
 * every mentioned product must show its exact DB price, and every number
 * must exist in the facts. Nothing is saved on verification failure.
 */
export async function generateEditorialForCatalogue(
  catalogueId: string
): Promise<EditorialResult> {
  const catalogue = await prisma.catalogue.findUnique({
    where: { id: catalogueId },
    include: {
      pages: { select: { id: true, pageNumber: true } },
      offers: { include: { product: true }, orderBy: { discountPercentage: "desc" } },
    },
  });
  if (!catalogue) return { success: false, error: "Catalogue not found" };
  if (catalogue.offers.length === 0) {
    return { success: false, error: "No offers to describe" };
  }

  const pageOf = new Map(catalogue.pages.map((p) => [p.id, p.pageNumber] as const));
  const catMap = new Map<string, { offers: number; maxDiscount: number }>();
  for (const o of catalogue.offers) {
    const name = o.product.category?.trim() || "Autres";
    const e = catMap.get(name) ?? { offers: 0, maxDiscount: 0 };
    e.offers += 1;
    e.maxDiscount = Math.max(e.maxDiscount, o.discountPercentage ?? 0);
    catMap.set(name, e);
  }
  const categories = [...catMap.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.offers - a.offers)
    .slice(0, 8);

  const deals = catalogue.offers.slice(0, 12).map((o) => ({
    name: o.product.name,
    brand: o.product.brand,
    originalPrice: o.originalPrice,
    salePrice: o.salePrice,
    discount: o.discountPercentage,
    category: o.product.category,
    page: o.cataloguePageId ? (pageOf.get(o.cataloguePageId) ?? null) : null,
    specs: specHints(o.product.specifications),
  }));

  const counts = {
    offers: catalogue.offers.length,
    products: new Set(catalogue.offers.map((o) => o.productId)).size,
    pages: catalogue.pageCount,
  };
  const facts = buildFacts(
    { title: catalogue.title, startDate: catalogue.startDate, endDate: catalogue.endDate },
    counts,
    categories,
    deals
  );

  const provider = await AIProviderFactory.create(
    process.env.AI_PROVIDER || "gemini",
    process.env as Record<string, string | undefined>
  );

  let lastFailure = "unknown";
  let lastText = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const strict = attempt === 2
      ? "\nRAPPEL STRICT : tu as inventé un chiffre ou un produit hors FAITS. Recommence en ne citant QUE des éléments du bloc FAITS."
      : "";
    const text = (await provider.generateText(`${EDITORIAL_PROMPT}${strict}\n\nFAITS:\n${facts}`)).trim();
    lastText = text;

    const paras = text.split(/\n\s*\n/).filter(Boolean);
    if (paras.length < 2 || text.split(/\s+/).length > 260) {
      lastFailure = `shape (paragraphs=${paras.length})`;
      continue;
    }

    // Guard 1: mentioned products must carry one of their exact DB prices.
    const priceCheck = verifyEditorialPrices(
      text,
      catalogue.offers.map((o) => ({ salePrice: o.salePrice, product: { name: o.product.name } }))
    );
    if (priceCheck.checked < 1 || priceCheck.score !== 100) {
      lastFailure = `price-check(checked=${priceCheck.checked},score=${priceCheck.score})`;
      continue;
    }

    // Guard 2: every amount must exist in the facts (tolerance for rounding).
    // The allowlist covers ALL offers (the prose may cite beyond the top 12).
    // Product/brand names are scrubbed first so model codes (IMX1005) and
    // spec fragments inside names don't read as numeric claims.
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let scrubbed = text;
    for (const o of catalogue.offers) {
      for (const token of [o.product.name, o.product.brand]) {
        if (token && token.trim().length >= 4) {
          scrubbed = scrubbed.replace(new RegExp(escapeRegExp(token.trim()), "gi"), " ");
        }
      }
    }
    const allNumbers: number[] = [];
    for (const o of catalogue.offers) {
      for (const n of [o.originalPrice, o.salePrice, o.discountPercentage]) {
        if (n != null) allNumbers.push(n);
      }
      const pn = o.cataloguePageId ? pageOf.get(o.cataloguePageId) : null;
      if (pn != null) allNumbers.push(pn);
      for (const s of specHints(o.product.specifications)) {
        for (const m of s.match(/\d[\d\s]*(?:[.,]\d+)?/g) ?? []) {
          let norm = m.replace(/\s/g, "");
          if (norm.includes(",")) norm = norm.replace(/\./g, "").replace(",", ".");
          const v = parseFloat(norm);
          if (!Number.isNaN(v)) allNumbers.push(v);
        }
      }
    }
    const allowed = factAmounts(counts, catalogue.startDate, catalogue.endDate, categories, deals, allNumbers);
    const unknown = extractAmounts(scrubbed).filter(
      (n) => !allowed.some((b) => Math.abs(n - b) < 0.005)
    );
    if (unknown.length > 0) {
      lastFailure = `unknown-numbers(${unknown.slice(0, 5).join(",")})`;
      continue;
    }

    await prisma.catalogue.update({
      where: { id: catalogueId },
      data: { description: paras.join("\n\n") },
    });
    return {
      success: true,
      text: paras.join("\n\n"),
      checks: { priceScore: priceCheck.score, checkedProducts: priceCheck.checked },
    };
  }

  try {
    require("fs").writeFileSync("/tmp/editorial-rejected.txt", lastText);
  } catch {
    // ignore
  }
  return { success: false, error: `AI output failed factual verification [${lastFailure}]` };
}
