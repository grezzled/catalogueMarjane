/**
 * Smart product identity for cross-catalogue deduplication.
 *
 * The same physical product is spelled many ways across catalogues:
 *   "Samsung TV 55\"", "Samsung 55 TV", "TV Samsung 55 pouces", "Samsung TV 55"
 * A naive lowercase comparison creates one Product row per spelling.
 *
 * Normalized identity (best → fallback):
 *   1. brand + manufacturer model number   (stable: UE55CU7172, MF109422…)
 *   2. brand + sorted core tokens + size + pack variant
 *   3. legacy exact normalizedName (backward compatibility)
 *
 * Numbers that are NOT attributable to size/variant/model are KEPT in the
 * core tokens on purpose ("iPhone 14" must never merge with "iPhone 15").
 *
 * Dependency-free on purpose (imported by worker services and scripts).
 */

export interface ProductIdentity {
  /** Lowercased brand, "" when unknown. */
  brand: string;
  /** Uppercase alnum manufacturer reference, or null. */
  modelNumber: string | null;
  /** Canonical size token ("55in", "1.5l", "500g", "128gb", "2000w"), or null. */
  size: string | null;
  /** Size value in canonical unit (for digit reconciliation), or null. */
  sizeNum: number | null;
  /** Pack variant ("pack3"), or null. */
  variant: string | null;
  /** Sorted significant tokens. */
  coreTokens: string[];
  /** coreTokens joined — human-readable part of the key. */
  coreName: string;
  /** Stable key: brand + model + size + variant + core. */
  identityKey: string;
}

export interface IdentityInput {
  name: string;
  /** Resolved brand (AI value or detectBrand), may be null. */
  brand?: string | null;
  /** AI-extracted model/reference, may be null. */
  aiModelNumber?: string | null;
  /** Free-text specs (features array or raw string), may be null. */
  specs?: string[] | string | null;
}

/** Legacy normalization — kept for backward compatibility (tier-3 fallback). */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBrandKey(brand: string | null | undefined): string {
  return (brand ?? "").trim().toLowerCase();
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function specsText(specs: string[] | string | null | undefined): string {
  if (!specs) return "";
  return Array.isArray(specs) ? specs.join(" ") : specs;
}

// ---------------------------------------------------------------------------
// Model number
// ---------------------------------------------------------------------------

/** Explicit "Réf. XXX / Modèle XXX / Ref: XXX" markers. */
const REF_MARKER_RE =
  /(?:r[eé]f(?:[eé]rence)?|mod[eè]le|model)\s*[.:]?\s*([a-z0-9][a-z0-9\-/]{2,19})/iu;
/**
 * Bare manufacturer references: letter-led, contains digits, 4–20 chars.
 * Matches UE55CU7172, MF109422, RT38K500… — not "TV", "55", "4K", "2000W".
 */
const MODEL_RE = /\b([A-Z]{1,6}\d[A-Z0-9]{1,12}(?:[-_][A-Z0-9]+){0,2})\b/;

export function extractModelNumber(
  name: string,
  specs?: string[] | string | null,
  aiModelNumber?: string | null
): string | null {
  if (aiModelNumber && aiModelNumber.trim()) {
    const cleaned = aiModelNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length >= 3 && cleaned.length <= 24 && /\d/.test(cleaned)) return cleaned;
  }
  const haystacks = [name, specsText(specs)];
  for (const hay of haystacks) {
    const marker = hay.match(REF_MARKER_RE);
    if (marker) {
      const cleaned = marker[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleaned.length >= 3 && cleaned.length <= 24) return cleaned;
    }
  }
  for (const hay of haystacks) {
    // Upper-cased: refs are conventionally uppercase ("ue55cu7172" still matches).
    const m = hay.toUpperCase().match(MODEL_RE);
    if (m) {
      const token = m[1];
      // Guard against pure spec fragments (e.g. "5G", energy classes handled by length rule).
      if (token.length >= 4 && token.length <= 20) return token;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Size → canonical token
// ---------------------------------------------------------------------------

function fmtNum(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function extractSize(
  name: string,
  specs?: string[] | string | null
): { token: string; raw: string; num: number } | null {
  const hay = `${name} ${specsText(specs)}`;
  const dehyphen = hay.replace(/[‐‑‒–—]/g, "-");

  // 1. Screen diagonal: 55", 55'', 55 pouces, 6,7"
  let m = dehyphen.match(/(\d+(?:[.,]\d+)?)\s*(?:"|''|″|pouces?)\b/i);
  if (m) {
    const inches = parseFloat(m[1].replace(",", "."));
    if (inches >= 3 && inches <= 130) return { token: `${fmtNum(inches)}in`, raw: m[0], num: inches };
  }
  // 2. Diagonal in cm (catalogues sometimes print 139 cm instead of 55").
  m = dehyphen.match(/(\d+(?:[.,]\d+)?)\s*cm\b/i);
  if (m) {
    const cm = parseFloat(m[1].replace(",", "."));
    if (cm >= 25 && cm <= 320) {
      const inches = Math.round(cm / 2.54);
      if (inches >= 10 && inches <= 130) return { token: `${inches}in`, raw: m[0], num: inches };
    }
  }
  // 3. "6 x 33 cl" style multipacks: pack count + unit size.
  m = dehyphen.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litres?|g|gr|kg)\b/i);
  if (m) {
    const unit = m[3].toLowerCase();
    const val = parseFloat(m[2].replace(",", "."));
    if (["ml", "cl", "l", "litre", "litres"].includes(unit)) {
      const liters = unit === "ml" ? val / 1000 : unit === "cl" ? val / 100 : val;
      if (liters > 0 && liters <= 500)
        return { token: `${fmtNum(liters)}l`, raw: m[0], num: liters };
    } else {
      const grams = unit === "kg" ? val * 1000 : val;
      if (grams > 0 && grams <= 100000) return { token: `${fmtNum(grams)}g`, raw: m[0], num: grams };
    }
  }
  // 4. Storage: 128 Go/GB, 1 To/TB.
  m = dehyphen.match(/(\d+(?:[.,]\d+)?)\s*(to|tb|go|gb)\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(",", "."));
    const gb = /t/i.test(m[2][0]) ? val * 1024 : val;
    if (gb >= 1 && gb <= 16384) return { token: `${fmtNum(gb)}gb`, raw: m[0], num: gb };
  }
  // 5. Volume: 500 ml, 75 cl, 1,5 L.
  m = dehyphen.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litres?)\b/i);
  if (m) {
    const unit = m[2].toLowerCase();
    const val = parseFloat(m[1].replace(",", "."));
    const liters = unit === "ml" ? val / 1000 : unit === "cl" ? val / 100 : val;
    if (liters > 0 && liters <= 500) return { token: `${fmtNum(liters)}l`, raw: m[0], num: liters };
  }
  // 6. Mass: 500 g, 1 kg.
  m = dehyphen.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr?)\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(",", "."));
    const grams = m[2].toLowerCase().startsWith("kg") ? val * 1000 : val;
    if (grams > 0 && grams <= 100000) return { token: `${fmtNum(grams)}g`, raw: m[0], num: grams };
  }
  // 7. Power: 2000 W.
  m = dehyphen.match(/(\d+(?:[.,]\d+)?)\s*w(?:atts?)?\b/i);
  if (m) {
    const val = parseFloat(m[1].replace(",", "."));
    if (val >= 1 && val <= 20000) return { token: `${fmtNum(val)}w`, raw: m[0], num: val };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pack variant
// ---------------------------------------------------------------------------

const VARIANT_RES = [
  /lot\s*(?:de\s*)?(\d{1,3})\b/i,
  /pack\s*(?:de\s*)?(\d{1,3})\b/i,
  /(\d{1,3})\s*pi[eè]ces?\b/i,
  /(\d{1,3})\s*pcs?\b/i,
  /\bx\s*(\d{1,3})\b/i,
  /(\d{1,3})\s*x\b/i,
];

export function extractVariant(
  name: string,
  specs?: string[] | string | null
): { token: string } | null {
  const hay = `${name} ${specsText(specs)}`;
  // "6 x 33 cl" multipack handled here too (size extractor covers the size part).
  const multi = hay.match(/(\d{1,3})\s*x\s*\d+(?:[.,]\d+)?\s*(?:ml|cl|l|litres?|g|gr|kg)\b/i);
  if (multi) {
    const n = parseInt(multi[1], 10);
    if (n >= 2 && n <= 999) return { token: `pack${n}` };
  }
  for (const re of VARIANT_RES) {
    const m = hay.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 2 && n <= 999) return { token: `pack${n}` };
    }
  }
  // Bare leading count ("3 pinceaux", "12 feutres") — capped so dimensions
  // like "55 TV" never become a pack size.
  const leading = hay.match(/^\s*(\d{1,2})\s+(?=[a-zà-ÿ])/i);
  if (leading) {
    const n = parseInt(leading[1], 10);
    if (n >= 2 && n <= 36) return { token: `pack${n}` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core tokens
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "de", "la", "le", "les", "des", "du", "un", "une", "d", "l",
  "a", "au", "aux", "en", "et", "ou", "pour", "avec", "sans",
  "par", "sur", "sous", "dans", "est", "the", "of", "a", "an",
  "and", "or", "for", "with",
]);

/** Pack/size marker words that carry no identity beyond the extracted tokens. */
const MARKER_WORDS = new Set([
  "lot", "lots", "pack", "packs", "piece", "pieces", "pcs", "pouce", "pouces",
  "cm", "mm", "litre", "litres", "ml", "cl", "gr", "g", "kg", "w", "watt",
  "watts", "go", "gb", "to", "tb",
]);

function tokenize(s: string): string[] {
  return (
    stripAccents(s.toLowerCase())
      // Split letter↔digit boundaries so "1L" and "1 L" tokenize alike
      // ("128go" → ["128","go"]; model refs split too and are filtered below).
      .replace(/([a-z])(?=\d)/g, "$1 ")
      .replace(/(\d)(?=[a-z])/g, "$1 ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

/** Light French plural stemming (consistency only, not linguistic accuracy). */
function stemFr(tok: string): string {
  if (tok.length > 3 && (tok.endsWith("s") || tok.endsWith("x"))) {
    return tok.slice(0, -1);
  }
  return tok;
}

/** Digits fingerprint of a size value: "55" → "55", 1.5 → "15", 0.33 → "33". */
export function sizeDigits(num: number): string {
  return fmtNum(num).replace(/[^0-9]/g, "").replace(/^0+/, "") || "0";
}

export function extractCoreTokens(
  name: string,
  brand: string,
  modelNumber: string | null,
  sizeRaw: string | null
): string[] {
  const brandTokens = new Set(tokenize(brand));
  // Model refs split apart by tokenization ("ue55cu7172" → ["ue","55","cu","7172"]),
  // so drop any token that is a substring of the compact reference.
  const modelCompact = (modelNumber ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const sizeTokens = new Set(sizeRaw ? tokenize(sizeRaw) : []);
  const out: string[] = [];
  for (const tok of tokenize(name)) {
    if (STOPWORDS.has(tok)) continue;
    if (MARKER_WORDS.has(tok)) continue;
    if (brandTokens.has(tok)) continue;
    if (modelCompact && tok.length >= 2 && modelCompact.includes(tok)) continue;
    if (sizeTokens.has(tok)) continue;
    // Single letters are segmentation noise ("d", "l" already stopwords; keep the rest out).
    if (tok.length < 2) continue;
    out.push(stemFr(tok));
  }
  out.sort();
  return out;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function buildIdentity(input: IdentityInput): ProductIdentity {
  const brand = normalizeBrandKey(input.brand);
  const modelNumber = extractModelNumber(input.name, input.specs, input.aiModelNumber);
  const size = extractSize(input.name, input.specs);
  const variant = extractVariant(input.name, input.specs);
  const coreTokens = extractCoreTokens(input.name, brand, modelNumber, size?.raw ?? null);
  const coreName = coreTokens.join(" ");
  const identityKey = [
    `b=${brand}`,
    `m=${modelNumber ?? ""}`,
    `s=${size?.token ?? ""}`,
    `v=${variant?.token ?? ""}`,
    `c=${coreName}`,
  ].join("|");
  return {
    brand,
    modelNumber,
    size: size?.token ?? null,
    sizeNum: size?.num ?? null,
    variant: variant?.token ?? null,
    coreTokens,
    coreName,
    identityKey,
  };
}

export type MatchTier = "model" | "key" | "legacy" | null;

export interface MatchCandidate {
  brand: string | null;
  modelNumber: string | null;
  size: string | null;
  /** Canonical-unit size value when known (lets bare numbers reconcile). */
  sizeNum?: number | null;
  variant?: string | null;
  identityKey: string | null;
  /** Stored sorted core ("55 tv") — tier 2b needs it verbatim. */
  coreName?: string | null;
  normalizedName: string;
  name: string;
}

/** Pure-numeric tokens of a core (["55"] — the `"1","5"` of "1,5 L" stays split). */
function numericTokens(coreTokens: string[]): string[] {
  return coreTokens.filter((t) => /^\d+$/.test(t));
}

/**
 * Hard identity signals: manufacturer ref, pack/size, variant.
 * Brand and bare core words are NOT enough on their own — generic names
 * ("Jogging col rond", "Trousse") with no such signal must never merge
 * across extractions, or distinct items collapse into one product page.
 */
export function hasStrongSignals(
  id: Pick<ProductIdentity, "modelNumber" | "size" | "variant">
): boolean {
  return id.modelNumber != null || id.size != null || id.variant != null;
}

/**
 * Do these two identities describe the same physical product?
 * Tier "model" (brand + manufacturer ref, size-compatible) wins over
 * tier "key" (full normalized identity, with numeric reconciliation),
 * which wins over the legacy exact-name fallback (checked by callers).
 *
 * Precision-first: bare-core keys (no model/size/variant on either side)
 * never match — the same generic name on two pages/prices is far more
 * likely two distinct items than one item seen twice.
 */
export function matchIdentity(a: ProductIdentity, b: MatchCandidate): MatchTier {
  const bBrand = normalizeBrandKey(b.brand);
  const bModel = (b.modelNumber ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const aSize = a.size ?? null;
  const bSize = b.size ?? null;
  const aVariant = a.variant ?? null;
  const bVariant = b.variant ?? null;

  // Tier 1 — manufacturer reference: same ref + same brand. Size may be
  // absent on one side (refs like UE55… already encode it); a present-but-
  // different size still vetoes.
  if (
    a.modelNumber &&
    bModel &&
    a.modelNumber === bModel &&
    a.brand !== "" &&
    a.brand === bBrand &&
    (aSize === bSize || aSize == null || bSize == null)
  ) {
    return "model";
  }

  // Tier 2 — full normalized identity. Signal-less keys never match: an
  // empty core with no model/size/variant is extraction junk ("• kg à",
  // prices parsed as names) and any junk would otherwise merge with junk.
  // Same for bare-core keys: "Jogging col rond" (no model/size/variant)
  // on two pages is two joggings, not one — keys are equal since the
  // tokens are equal, so strength is checked explicitly on both sides.
  const hasSignal =
    a.coreName !== "" || a.modelNumber != null || a.size != null || a.variant != null;
  const bStrong = b.modelNumber != null || b.size != null || b.variant != null;
  if (b.identityKey && hasSignal && hasStrongSignals(a) && bStrong && a.identityKey === b.identityKey) return "key";

  // Tier 2b — same core modulo bare numbers, with the size digits bridging
  // the gap ("Samsung 55 TV" vs "TV Samsung 55 pouces"). Strict everywhere
  // else: same brand, same variant, and exactly one side missing the size
  // whose digits appear in the other side's bare numbers.
  if (a.brand === bBrand && aVariant === bVariant) {
    const bCore = (b.coreName ?? "").split(" ").filter(Boolean);
    const aNoNum = a.coreTokens.filter((t) => !/^\d+$/.test(t));
    const bNoNum = bCore.filter((t) => !/^\d+$/.test(t));
    if (
      bCore.length > 0 &&
      aNoNum.length === bNoNum.length &&
      aNoNum.every((t, i) => t === bNoNum[i]) &&
      ((aSize == null && bSize != null) || (bSize == null && aSize != null))
    ) {
      const sizedNum = a.sizeNum ?? b.sizeNum ?? null;
      const bareNums = numericTokens((aSize == null ? a.coreTokens : bCore));
      const bareJoined = bareNums.join("").replace(/^0+/, "");
      const want = sizedNum != null ? sizeDigits(sizedNum) : "";
      if (
        want &&
        (bareNums.some((t) => t.replace(/^0+/, "") === want) || (bareJoined !== "" && bareJoined === want))
      ) {
        return "key";
      }
    }
  }

  return null;
}

/** Standalone legacy comparison used by tier 3 (kept explicit for clarity). */
export function legacyMatches(aName: string, bNormalizedName: string): boolean {
  return normalizeProductName(aName) === bNormalizedName;
}
