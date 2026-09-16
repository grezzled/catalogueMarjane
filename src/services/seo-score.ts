/**
 * Deterministic SEO scoring — no AI involved. Every point is computed from
 * the article's stored fields and content, so the score is reproducible and
 * each deduction maps to a concrete fix.
 *
 * Weights (total 100):
 * title 10 | meta 10 | h1 5 | depth 10 | internal links 15 | images 10 |
 * alt 5 | structured data 10 | product entities 10 | catalogue links 10 |
 * freshness 5
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  key: string;
  label: string;
  maxPoints: number;
  points: number;
  status: CheckStatus;
  detail: string;
}

export interface SeoScorecard {
  score: number;
  maxScore: 100;
  checks: SeoCheck[];
}

export interface ScorableArticle {
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  content: string;
  faq?: Array<{ question: string; answer: string }> | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  /** Distinct catalogue offers backing the article (for entity depth). */
  offerCount?: number;
  /** Whether another article already uses this exact title. */
  titleUnique?: boolean;
}

function statusOf(points: number, max: number): CheckStatus {
  if (points >= max) return "pass";
  if (points <= 0) return "fail";
  return "warn";
}

function check(
  key: string,
  label: string,
  maxPoints: number,
  points: number,
  detail: string
): SeoCheck {
  const p = Math.max(0, Math.min(maxPoints, Math.round(points)));
  return { key, label, maxPoints, points: p, status: statusOf(p, maxPoints), detail };
}

function markdownLinks(content: string): Array<{ text: string; href: string }> {
  const out: Array<{ text: string; href: string }> = [];
  const re = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    // Skip image syntax ![alt](src)
    const before = content[m.index - 1];
    if (before === "!") continue;
    out.push({ text: m[1], href: m[2] });
  }
  return out;
}

function markdownImages(content: string): Array<{ alt: string; src: string }> {
  const out: Array<{ alt: string; src: string }> = [];
  const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push({ alt: m[1].trim(), src: m[2] });
  }
  return out;
}

function wordCount(content: string): number {
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
}

function h1Count(content: string): number {
  return content.split("\n").filter((line) => /^#\s+\S/.test(line.trim())).length;
}

export function scoreArticle(input: ScorableArticle): SeoScorecard {
  const content = input.content || "";
  const checks: SeoCheck[] = [];

  // 1. Title — 10 (present 2, unique 3, meta title 45–65 chars 5)
  const title = (input.title || "").trim();
  const metaTitle = (input.metaTitle || "").trim();
  let titlePoints = 0;
  const titleBits: string[] = [];
  if (title) {
    titlePoints += 2;
    titleBits.push("title present");
  } else {
    titleBits.push("missing title");
  }
  if (input.titleUnique !== false && title) {
    titlePoints += 3;
    titleBits.push("unique");
  } else if (title) {
    titleBits.push("duplicate title");
  }
  if (metaTitle.length >= 45 && metaTitle.length <= 65) {
    titlePoints += 5;
    titleBits.push(`meta ${metaTitle.length} chars`);
  } else {
    titleBits.push(
      metaTitle ? `meta ${metaTitle.length} chars (want 45–65)` : "no meta title"
    );
  }
  checks.push(check("title", "Title", 10, titlePoints, titleBits.join(" · ")));

  // 2. Meta description — 10 (present 3, 120–170 chars 7)
  const meta = (input.metaDescription || "").trim();
  let metaPoints = 0;
  if (meta) {
    metaPoints += 3;
    if (meta.length >= 120 && meta.length <= 170) metaPoints += 7;
  }
  checks.push(
    check(
      "meta",
      "Meta description",
      10,
      metaPoints,
      meta ? `${meta.length} chars (want 120–170)` : "missing meta description"
    )
  );

  // 3. H1 — 5 (exactly one)
  const h1s = h1Count(content);
  checks.push(
    check(
      "h1",
      "H1",
      5,
      h1s === 1 ? 5 : 0,
      h1s === 1 ? "single H1" : h1s === 0 ? "no H1 found" : `${h1s} H1s found (want exactly 1)`
    )
  );

  // 4. Content depth — 10
  const words = wordCount(content);
  const depthPoints = words >= 800 ? 10 : words >= 500 ? 7 : words >= 250 ? 4 : 0;
  checks.push(
    check("depth", "Content depth", 10, depthPoints, `${words.toLocaleString()} words`)
  );

  // 5. Internal links — 15
  const internal = new Set(
    markdownLinks(content)
      .map((l) => l.href)
      .filter((h) => h.startsWith("/") && !h.startsWith("//"))
  );
  const linkCount = internal.size;
  const linkPoints =
    linkCount >= 10 ? 15 : linkCount >= 6 ? 11 : linkCount >= 3 ? 7 : linkCount >= 1 ? 3 : 0;
  checks.push(
    check("links", "Internal links", 15, linkPoints, `${linkCount} distinct internal links`)
  );

  // 6. Images — 10
  const images = markdownImages(content);
  const imagePoints = images.length >= 5 ? 10 : images.length >= 3 ? 7 : images.length >= 1 ? 4 : 0;
  checks.push(
    check("images", "Images", 10, imagePoints, `${images.length} images`)
  );

  // 7. Image alt — 5
  let altPoints = 0;
  let altDetail = "no images to describe";
  if (images.length > 0) {
    const withAlt = images.filter((i) => i.alt.length > 0).length;
    const ratio = withAlt / images.length;
    altPoints = ratio >= 1 ? 5 : ratio >= 0.5 ? 3 : withAlt > 0 ? 1 : 0;
    altDetail = `${withAlt}/${images.length} images have alt text`;
  }
  checks.push(check("alt", "Image alt", 5, altPoints, altDetail));

  // 8. Structured data — 10 (FAQ 5 + verified offers table 5)
  const faq = Array.isArray(input.faq) ? input.faq : [];
  const validFaq = faq.filter((f) => f && f.question && f.answer).length;
  const hasTable = /\|[^|\n]+\|[^|\n]*\|/.test(content) && /offres vérifiées/i.test(content);
  const structuredPoints = (validFaq >= 3 ? 5 : validFaq > 0 ? 2 : 0) + (hasTable ? 5 : 0);
  const structuredBits = [
    validFaq >= 3 ? `${validFaq} FAQ entries` : validFaq > 0 ? `only ${validFaq} FAQ entries (want 3+)` : "no FAQ",
    hasTable ? "verified table present" : "no verified offers table",
  ];
  checks.push(
    check("structured", "Structured data", 10, structuredPoints, structuredBits.join(" · "))
  );

  // 9. Product entities — 10 (catalogue offer depth behind the article)
  const offers = input.offerCount ?? 0;
  const entityPoints = offers >= 15 ? 10 : offers >= 8 ? 6 : offers >= 3 ? 3 : 0;
  checks.push(
    check("entities", "Product entities", 10, entityPoints, `${offers} catalogue offers`)
  );

  // 10. Catalogue links — 10
  const catalogueLinks = new Set(
    markdownLinks(content)
      .map((l) => l.href)
      .filter((h) => h.startsWith("/catalogue-marjane/"))
  ).size;
  const cataloguePoints =
    catalogueLinks >= 3 ? 10 : catalogueLinks === 2 ? 6 : catalogueLinks === 1 ? 3 : 0;
  checks.push(
    check(
      "catalogue-links",
      "Catalogue links",
      10,
      cataloguePoints,
      `${catalogueLinks} distinct catalogue links`
    )
  );

  // 11. Freshness — 5
  const ref = input.publishedAt ?? input.updatedAt ?? null;
  const ageDays = ref
    ? (Date.now() - new Date(ref).getTime()) / 86400000
    : Number.POSITIVE_INFINITY;
  const freshPoints = ageDays <= 14 ? 5 : ageDays <= 30 ? 3 : ageDays <= 90 ? 1 : 0;
  checks.push(
    check(
      "freshness",
      "Freshness",
      5,
      freshPoints,
      Number.isFinite(ageDays) ? `updated ${Math.max(0, Math.floor(ageDays))}d ago` : "no date"
    )
  );

  const score = checks.reduce((sum, c) => sum + c.points, 0);
  return { score, maxScore: 100, checks };
}
