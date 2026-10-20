import type { PageAnalysis } from "@/types";

export interface PageEditorial {
  title: string;
  summary: string;
  imageAlt: string;
}

const MARKETING_WORDS = [
  "incroyable",
  "exceptionnel",
  "exceptionnelle",
  "fabuleux",
  "fabuleuse",
  "révolutionnaire",
  "unique",
  "meilleur",
  "meilleure",
  "meilleurs",
  "meilleures",
  "magique",
  "spectaculaire",
];

const FORMULA_PHRASES = [
  "complètent cette page",
  "ne manquez pas",
  "il y en a pour tous les goûts",
  "faites le plein",
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentences(value: string): string[] {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function withoutMarketing(value: string): boolean {
  const lower = value.toLowerCase();
  return !MARKETING_WORDS.some((word) => lower.includes(word)) &&
    !FORMULA_PHRASES.some((phrase) => lower.includes(phrase));
}

function clampTitle(value: string | null | undefined): string | null {
  if (!value) return null;
  const words = normalizeWhitespace(value).split(" ").filter(Boolean);
  if (words.length === 0) return null;
  return words.slice(0, 8).join(" ").replace(/[.,;:]+$/, "");
}

function fallbackSummary(analysis: PageAnalysis, pageNumber: number): string {
  const names = (analysis.products ?? [])
    .map((p) => normalizeWhitespace(p.name))
    .filter(Boolean)
    .slice(0, 4);

  if (names.length === 0) {
    return `La page ${pageNumber} du catalogue rassemble les offres de la thématique ${analysis.category || analysis.title || "du moment"}. Elle regroupe les produits présentés dans cette partie du catalogue Marjane.`;
  }
  if (names.length === 1) {
    return `Cette page met en avant ${names[0]} parmi les offres du catalogue. Elle permet de retrouver ce produit dans la page ${pageNumber} du catalogue Marjane.`;
  }
  return `Cette page présente ${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}. Ces produits sont regroupés dans la page ${pageNumber} du catalogue Marjane.`;
}

function fallbackTitle(analysis: PageAnalysis, pageNumber: number): string {
  const fromAnalysis = clampTitle(analysis.title);
  if (fromAnalysis) return fromAnalysis;
  const category = clampTitle(analysis.category);
  return category ? `Page ${pageNumber} : ${category}` : `Page ${pageNumber} du catalogue`;
}

/**
 * Normalize the page editorial fields returned with a page analysis.
 * The AI is instructed to follow the rules; this function protects the site
 * from marketing adjectives, formula phrases and malformed lengths.
 */
export function normalizePageEditorial(
  analysis: PageAnalysis,
  pageNumber: number
): PageEditorial {
  const fallbackTitleValue = fallbackTitle(analysis, pageNumber);
  const title = clampTitle(analysis.editorialTitle) || fallbackTitleValue;

  const rawSummary = analysis.editorialSummary || analysis.summary || "";
  const summarySentences = sentences(rawSummary);
  const summary =
    summarySentences.length >= 2 && withoutMarketing(rawSummary)
      ? summarySentences.slice(0, 3).join(" ")
      : fallbackSummary(analysis, pageNumber);

  const rawAlt = analysis.imageAlt || "";
  const altSentence = sentences(rawAlt)[0] || "";
  const imageAlt =
    altSentence && withoutMarketing(altSentence)
      ? altSentence
      : `${title}, catalogue Marjane, page ${pageNumber}.`;

  return {
    title: normalizeWhitespace(title),
    summary: normalizeWhitespace(summary),
    imageAlt: normalizeWhitespace(imageAlt),
  };
}
