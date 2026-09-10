export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatDateFr(date: Date): string {
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateRange(start: Date, end: Date): string {
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const startDay = start.getDate();
  const startMonth = months[start.getMonth()];
  const endDay = end.getDate();
  const endMonth = months[end.getMonth()];
  const endYear = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startDay} au ${endDay} ${startMonth} ${endYear}`;
  }
  return `${startDay} ${startMonth} au ${endDay} ${endMonth} ${endYear}`;
}

export function generateCatalogueSlug(
  title: string,
  start: Date,
  end: Date
): string {
  const titlePart = slugify(title);
  const months = [
    "janvier",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "decembre",
  ];
  const datePart = `${start.getDate()}-${months[start.getMonth()]}-${end.getDate()}-${months[end.getMonth()]}-${end.getFullYear()}`;
  return `${titlePart}-${datePart}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function extractJsonFromAIResponse(text: string): unknown {
  let cleaned = text.trim();

  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {}

  cleaned = cleaned
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201C\u201D\u2018\u2019]/g, '"')
    .replace(/'/g, '"');

  try {
    return JSON.parse(cleaned);
  } catch {}

  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }

  throw new Error(`Failed to parse JSON from AI response: ${text.slice(0, 300)}`);
}

export function calculateDiscountPercentage(
  original: number,
  sale: number
): number {
  if (original <= 0) return 0;
  return Math.round(((original - sale) / original) * 100);
}

export function isCatalogueExpired(endDate: Date): boolean {
  return new Date() > endDate;
}

export function isCatalogueCurrent(
  startDate: Date,
  endDate: Date
): boolean {
  const now = new Date();
  return now >= startDate && now <= endDate;
}
