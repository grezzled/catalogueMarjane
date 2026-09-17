"use client";

/**
 * First-party shopping list ("Ma liste"): persisted in localStorage,
 * no account needed. Shareable via /liste?items=slug:qty,... URLs.
 */

export interface ListItem {
  slug: string;
  qty: number;
}

const KEY = "mc-shopping-list";
const EVENT = "mc-shopping-list-change";

function notify() {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore (SSR)
  }
}

export function onListChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function loadList(): ListItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ListItem[] = [];
    for (const e of parsed) {
      if (
        e &&
        typeof e === "object" &&
        typeof (e as { slug?: unknown }).slug === "string" &&
        (e as { slug: string }).slug.length > 0
      ) {
        const qty = Math.min(99, Math.max(1, Math.floor(Number((e as { qty?: unknown }).qty) || 1)));
        if (!out.some((o) => o.slug === (e as { slug: string }).slug)) {
          out.push({ slug: (e as { slug: string }).slug, qty });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

function save(items: ListItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full / private mode — list simply won't persist
  }
  notify();
}

export function addToList(slug: string, qty = 1): ListItem[] {
  const items = loadList();
  const found = items.find((i) => i.slug === slug);
  if (found) found.qty = Math.min(99, found.qty + qty);
  else items.push({ slug, qty: Math.min(99, Math.max(1, qty)) });
  save(items);
  return items;
}

export function removeFromList(slug: string): ListItem[] {
  const items = loadList().filter((i) => i.slug !== slug);
  save(items);
  return items;
}

export function setQty(slug: string, qty: number): ListItem[] {
  if (qty <= 0) return removeFromList(slug);
  const items = loadList().map((i) => (i.slug === slug ? { ...i, qty: Math.min(99, qty) } : i));
  save(items);
  return items;
}

export function clearList(): ListItem[] {
  save([]);
  return [];
}

export function replaceList(items: ListItem[]): ListItem[] {
  const clean = items
    .filter((i) => typeof i.slug === "string" && i.slug.length > 0)
    .map((i) => ({ slug: i.slug, qty: Math.min(99, Math.max(1, Math.floor(i.qty) || 1)) }));
  save(clean);
  return clean;
}

/** ?items=slug-a:2,slug-b → [{slug,qty}] (qty defaults to 1). */
export function parseSharedItems(param: string | null): ListItem[] {
  if (!param) return [];
  const out: ListItem[] = [];
  for (const part of param.split(",")) {
    const [rawSlug, rawQty] = part.split(":");
    const slug = (rawSlug || "").trim().slice(0, 120);
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) continue;
    const qty = Math.min(99, Math.max(1, parseInt(rawQty || "1", 10) || 1));
    if (!out.some((o) => o.slug === slug)) out.push({ slug, qty });
  }
  return out.slice(0, 100);
}

export function serializeSharedItems(items: ListItem[]): string {
  return items.map((i) => (i.qty > 1 ? `${i.slug}:${i.qty}` : i.slug)).join(",");
}
