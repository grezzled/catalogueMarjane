"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Minus, Plus, Printer, Share2, ShoppingCart, Trash2, X } from "lucide-react";
import type { ProductResult } from "@/services/products";
import {
  clearList,
  loadList,
  onListChange,
  parseSharedItems,
  removeFromList,
  replaceList,
  serializeSharedItems,
  setQty,
  type ListItem,
} from "@/lib/shopping-list";

const CHECKED_KEY = "mc-shopping-checked";

function loadChecked(): string[] {
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    // ignore
  }
  return [];
}

/** Phones get the native share sheet, desktops get a link copy. */
function wantsNativeShare(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { share?: unknown; userAgentData?: { mobile?: boolean } };
  if (typeof nav.share !== "function") return false;
  if (nav.userAgentData && typeof nav.userAgentData.mobile === "boolean") return nav.userAgentData.mobile;
  if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) return true;
  return false;
}

function unitPrice(p: ProductResult): number | null {
  return p.currentOffer?.salePrice ?? p.bestPrice;
}

export default function ShoppingListManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shared = useMemo(() => parseSharedItems(searchParams.get("items")), [searchParams]);
  const [adopted, setAdopted] = useState(false);
  const [ownItems, setOwnItems] = useState<ListItem[]>(() => loadList());
  const [products, setProducts] = useState<Record<string, ProductResult>>({});
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>(() => loadChecked());
  const [sharedMsg, setSharedMsg] = useState<string | null>(null);

  const showShared = shared.length > 0 && !adopted;
  const activeItems = showShared ? shared : ownItems;

  useEffect(() => {
    // Subscription callback only — initial state comes from the lazy initializer.
    return onListChange(() => setOwnItems(loadList()));
  }, []);

  const fetchKey = activeItems.map((i) => `${i.slug}:${i.qty}`).join("|");

  useEffect(() => {
    if (fetchedKey === fetchKey) return;
    if (fetchKey === "") {
      // Empty list — resolve immediately through the same async path.
      Promise.resolve().then(() => {
        setProducts({});
        setFetchedKey(fetchKey);
      });
      return;
    }
    let cancelled = false;
    fetch(`/api/products/batch?slugs=${encodeURIComponent(activeItems.map((i) => i.slug).join(","))}`)
      .then(async (res) => {
        if (cancelled) return;
        const body = (await res.json().catch(() => null)) as { products?: ProductResult[] } | null;
        const map: Record<string, ProductResult> = {};
        for (const p of body?.products ?? []) {
          map[p.slug.toLowerCase()] = p;
          map[p.id.toLowerCase()] = p;
        }
        setProducts(map);
      })
      .catch(() => {
        if (!cancelled) setProducts({});
      })
      .finally(() => {
        if (!cancelled) setFetchedKey(fetchKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, fetchedKey]);

  const loading = fetchedKey !== fetchKey;

  function toggleCheck(slug: string) {
    setChecked((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem(CHECKED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const rows = useMemo(
    () =>
      activeItems.map((item) => ({
        item,
        product: products[item.slug.toLowerCase()] ?? null,
        checked: checked.includes(item.slug),
      })),
    [activeItems, products, checked]
  );
  const resolved = rows.filter((r) => r.product);
  const missing = rows.length - resolved.length;
  const checkedCount = rows.filter((r) => r.checked).length;
  const total = resolved.reduce((s, r) => s + (unitPrice(r.product!) ?? 0) * r.item.qty, 0);
  const unpriced = resolved.filter((r) => unitPrice(r.product!) == null).length;

  function adoptShared() {
    replaceList(shared);
    setAdopted(true);
    router.replace("/liste");
  }

  async function share() {
    const items = showShared ? shared : ownItems;
    if (items.length === 0) return;
    const url = `${window.location.origin}/liste?items=${serializeSharedItems(items)}`;
    const text = `Ma liste Marjane : ${items.length} produit${items.length > 1 ? "s" : ""}` +
      (total > 0 ? ` (~${Math.round(total).toLocaleString()} DH)` : "");
    try {
      if (wantsNativeShare()) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Ma liste Marjane",
          text,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setSharedMsg("Lien copié ! 📋");
      window.setTimeout(() => setSharedMsg(null), 2500);
    } catch {
      setSharedMsg("Partage annulé.");
      window.setTimeout(() => setSharedMsg(null), 2500);
    }
  }

  return (
    <div>
      {showShared && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-blue-900">
            📩 <span className="font-bold">Liste partagée</span> — {shared.length} produit{shared.length > 1 ? "s" : ""}.
            Enregistrez-la pour la modifier et la garder sur cet appareil.
          </p>
          <button
            type="button"
            onClick={adoptShared}
            className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            ＋ Enregistrer dans ma liste
          </button>
        </div>
      )}

      {!showShared && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={share}
            disabled={ownItems.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-40"
          >
            <Share2 className="h-4 w-4" />
            Partager
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={ownItems.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-gray-400 disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          {ownItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Vider toute la liste ?")) clearList();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:border-red-300"
            >
              <Trash2 className="h-4 w-4" />
              Vider
            </button>
          )}
          {sharedMsg && <span className="text-sm font-medium text-blue-700">{sharedMsg}</span>}
          {resolved.length > 0 && (
            <span className="ml-auto text-sm text-gray-500 tabular-nums">
              {checkedCount}/{resolved.length} cochés
            </span>
          )}
        </div>
      )}

      {showShared && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700"
          >
            <Share2 className="h-4 w-4" />
            Partager
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-gray-400"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          {sharedMsg && <span className="text-sm font-medium text-blue-700">{sharedMsg}</span>}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-500">
          Chargement de la liste…
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-900">Votre liste est vide</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Ajoutez des produits depuis leurs fiches pour préparer vos courses.</p>
          <Link href="/produits" className="inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
            Parcourir les produits
          </Link>
        </div>
      ) : (
        <>
          {checkedCount > 0 && (
            <div className="mb-3 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(checkedCount / resolved.length) * 100}%` }} />
            </div>
          )}
          <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden print:border-0">
            {rows.map(({ item, product, checked: done }) => (
              <li key={item.slug} className={`p-3 sm:p-4 ${done ? "bg-gray-50" : ""}`}>
                <div className="flex items-center gap-3">
                  {!showShared && (
                    <button
                      type="button"
                      onClick={() => toggleCheck(item.slug)}
                      aria-label={done ? "Décocher" : "Cocher comme acheté"}
                      className={`no-print shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                        done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 hover:border-green-400"
                      }`}
                    >
                      {done && <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                  )}
                  {product?.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-12 h-12 object-contain rounded-lg bg-gray-50 shrink-0" loading="lazy" />
                  ) : (
                    <span className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {product ? (
                      <Link href={`/produit/${product.slug}`} className={`font-semibold text-sm text-gray-900 hover:text-blue-700 line-clamp-2 ${done ? "line-through text-gray-400" : ""}`}>
                        {product.name}
                      </Link>
                    ) : (
                      <p className="text-sm text-gray-400">Produit introuvable ({item.slug})</p>
                    )}
                    <p className="text-xs text-gray-500 tabular-nums">
                      {product && unitPrice(product) != null ? (
                        <>{unitPrice(product)!.toLocaleString()} DH / pièce{product.currentOffer ? "" : " (dernier prix)"}</>
                      ) : (
                        "Prix à venir"
                      )}
                    </p>
                  </div>
                  {!showShared && (
                    <button type="button" onClick={() => removeFromList(item.slug)} aria-label="Retirer de la liste" className="no-print shrink-0 p-1.5 -m-1.5 text-gray-300 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3 pl-10">
                  {!showShared ? (
                    <div className="no-print flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => setQty(item.slug, item.qty - 1)} aria-label="Diminuer" className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:border-gray-400 active:bg-gray-100">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold tabular-nums">{item.qty}</span>
                      <button type="button" onClick={() => setQty(item.slug, item.qty + 1)} aria-label="Augmenter" className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:border-gray-400 active:bg-gray-100">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-bold tabular-nums shrink-0">×{item.qty}</span>
                  )}
                  {!showShared && item.qty > 1 && (
                    <span className="hidden print:inline text-sm font-bold tabular-nums shrink-0">×{item.qty}</span>
                  )}
                  <span className="text-sm font-bold text-gray-900 tabular-nums ml-auto shrink-0">
                    {product && unitPrice(product) != null ? `${(unitPrice(product)! * item.qty).toLocaleString()} DH` : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {missing > 0 && (
            <p className="mt-2 text-xs text-gray-400">{missing} produit{missing > 1 ? "s" : ""} introuvable{missing > 1 ? "s" : ""} ignoré{missing > 1 ? "s" : ""}.</p>
          )}
          <div className="mt-4 bg-gray-900 text-white rounded-2xl p-5 flex flex-wrap items-center gap-3 print:bg-white print:text-black print:border print:border-gray-300">
            <div>
              <p className="text-xs opacity-70">Total estimé{unpriced > 0 ? ` (${unpriced} sans prix exclus)` : ""}</p>
              <p className="text-3xl font-extrabold tabular-nums">{Math.round(total).toLocaleString()} DH</p>
            </div>
            <p className="ml-auto text-xs opacity-60 max-w-60">
              Estimation basée sur les derniers prix Marjane relevés — prix réels à vérifier en magasin.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
