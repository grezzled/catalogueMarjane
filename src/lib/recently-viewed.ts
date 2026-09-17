/**
 * Recently-viewed products (per-browser, localStorage). No account, no
 * server state — complements the aggregate "Tendances" block.
 */

const KEY = "mc-recently-viewed";
const MAX = 12;

export function recordRecentView(slug: string): void {
  if (!slug) return;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
    const next = [slug, ...list.filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode — simply not remembered
  }
}

export function loadRecentViews(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function clearRecentViews(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
