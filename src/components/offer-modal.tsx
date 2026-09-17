"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { X, Package, Tag, CreditCard, ShieldCheck, Check, Share2, History } from "lucide-react";
import { AddToListButton } from "@/components/list-buttons";
import { Dialog, DialogTrigger, DialogClose, DialogContent, DialogBody } from "@/components/ui/dialog";
import AlertSubscribe from "@/components/alert-subscribe";

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const uploadsIdx = imagePath.indexOf("uploads/");
  if (uploadsIdx !== -1) {
    return "/" + imagePath.slice(uploadsIdx);
  }
  return imagePath;
}

export interface OfferModalOffer {
  id: string;
  /** Product id when the caller has it (deep link fallback). */
  productId?: string;
  originalPrice: number | null;
  salePrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  installmentAmount: number | null;
  installmentMonths: number | null;
  availability: string | null;
  conditions: string | null;
  promotionalDates: string | null;
  startDate: Date | string;
  endDate: Date | string;
  product: {
    name: string;
    category: string;
    brand: string | null;
    subcategory: string | null;
    specifications: string | null;
    imageUrl: string | null;
    /** Present at runtime whenever the query selects the full product. */
    id?: string;
    slug?: string | null;
  };
  catalogue?: {
    slug: string;
    title: string;
  };
  cataloguePage?: {
    pageNumber: number;
    imagePath: string | null;
    aiAnalysis?: string | null;
  } | null;
}

interface OfferModalProps {
  offer: OfferModalOffer;
  catalogueSlug: string;
  catalogueTitle?: string;
  showFeatures?: boolean;
  showArticles?: boolean;
  /** "dialog" = centered popup, "sheet" = bottom sheet sliding from the bottom */
  variant?: "dialog" | "sheet";
  /** Same-category offers shown under "Autres promotions intéressantes" — tapping one swaps the sheet content. */
  relatedOffers?: OfferModalOffer[];
  /** Controlled mode (e.g. opened from a page hotspot): omit for trigger mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

// Web Share sheet only makes sense on phones: desktop browsers
// increasingly expose navigator.share (OS share menu), where users
// expect a simple link copy instead.
function canNativeShare(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    userAgentData?: { mobile?: boolean };
  };
  if (typeof nav.share !== "function") return false;
  if (nav.userAgentData && typeof nav.userAgentData.mobile === "boolean") {
    return nav.userAgentData.mobile;
  }
  if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) return true;
  // Touch-only small screens (phones/tablets). Touchscreen laptops fall
  // through to copy — pointer: fine is the tiebreaker.
  if (
    window.matchMedia?.("(pointer: coarse)").matches &&
    !window.matchMedia?.("(pointer: fine)").matches &&
    Math.min(window.screen.width, window.screen.height) < 820
  ) {
    return true;
  }
  return false;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard API needs a secure context — legacy fallback.
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function prettifyKey(key: string): string {
  const cleaned = key.replace(/[_-]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

interface SpecRow {
  key?: string;
  value: string;
}

// Specifications may be a JSON object ({ram: "4 Go"}), a JSON array
// (["Ecran 6,7\"", "ROM 128 Go"]) or plain text — never render raw keys.
function parseSpecifications(specs: string | null): SpecRow[] | null {
  if (!specs) return null;
  try {
    const parsed: unknown = JSON.parse(specs);
    if (Array.isArray(parsed)) {
      const items = parsed
        .filter((v) => v != null && String(v).trim() !== "")
        .map((v) => ({ value: String(v) }));
      return items.length > 0 ? items : null;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const entries = Object.entries(parsed).map(([key, value]) => ({
        key: prettifyKey(key),
        value: String(value),
      }));
      return entries.length > 0 ? entries : null;
    }
    return null;
  } catch {
    const lines = specs
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((value) => ({ value }));
    return lines.length > 0 ? lines : null;
  }
}

function parseFeatures(aiAnalysis: string | null, productName: string): string[] {
  if (!aiAnalysis) return [];
  try {
    const analysis = JSON.parse(aiAnalysis);
    const product = analysis.products?.find((p: any) => p.name === productName);
    return product?.features || [];
  } catch {
    return [];
  }
}

export default function OfferModal({
  offer,
  showFeatures = false,
  variant = "dialog",
  relatedOffers = [],
  open: controlledOpen,
  onOpenChange,
  children,
}: OfferModalProps) {
  const [shared, setShared] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  function setIsOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }
  // The displayed offer — tapping a related offer swaps the whole sheet.
  const [current, setCurrent] = useState<OfferModalOffer>(offer);
  const bodyTopRef = useRef<HTMLDivElement>(null);
  const specs = parseSpecifications(current.product.specifications);
  const features = showFeatures ? parseFeatures(current.cataloguePage?.aiAnalysis || null, current.product.name) : [];

  function switchOffer(next: OfferModalOffer) {
    setCurrent(next);
    setShared(false);
    bodyTopRef.current?.parentElement?.scrollTo({ top: 0 });
  }

  async function shareOffer() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const price = current.salePrice != null ? ` — ${current.salePrice.toLocaleString()} DH` : "";
    const text = `${current.product.name}${price}`;
    try {
      // Phone → native share sheet. Desktop/browser → copy link
      // (navigator.share exists on some desktops, so UA/capability
      // detection decides — not feature presence alone).
      if (canNativeShare()) {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
        await nav.share?.({ title: current.product.name, text, url });
        return;
      }
      await copyText(`${text} ${url}`.trim());
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  const siblings = relatedOffers.filter((o) => o.id !== current.id).slice(0, 6);

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { setIsOpen(next); if (next) { setCurrent(offer); setShared(false); } }}>
      <DialogTrigger asChild>
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">{children}</div>
      </DialogTrigger>

      <DialogContent
        label={current.product.name}
        className={variant === "sheet" ? "sm:max-w-2xl" : ""}
      >
        {/* Fixed header — share + close live here, in-flow, never over content */}
        <div className="flex items-center justify-end gap-2 px-4 pt-4 shrink-0">
          <button
            onClick={shareOffer}
            aria-label="Partager cette offre"
            title={shared ? "Lien copié !" : "Partager"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg shrink-0 ${
              shared
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            {shared ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
          </button>
          <DialogClose
            aria-label="Fermer"
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg shrink-0 bg-gray-900 text-white hover:bg-gray-700"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </DialogClose>
        </div>

        <DialogBody>
          <div ref={bodyTopRef} className="pb-[env(safe-area-inset-bottom)]">
            <div className="flex-1 min-w-0 p-4 sm:p-6">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-3 sm:gap-4">
                  <div className="shrink-0 w-36 h-36 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                    {current.product.imageUrl && toImageUrl(current.product.imageUrl) ? (
                      <img
                        src={toImageUrl(current.product.imageUrl)!}
                        alt={current.product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                        {current.product.category}
                      </span>
                      {current.product.subcategory && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {current.product.subcategory}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-2 text-balance">
                      {current.product.name}
                    </h2>
                    {current.product.brand && (
                      <p className="text-sm text-gray-500 mt-0.5">{current.product.brand}</p>
                    )}
                    <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-2">
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                        Du {new Date(current.startDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                        Au {new Date(current.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 sm:p-5 text-center">
                  <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                    {current.originalPrice && (
                      <span className="text-gray-400 line-through text-base sm:text-lg">
                        {current.originalPrice.toLocaleString()} DH
                      </span>
                    )}
                    {current.salePrice && (
                      <span className="text-red-600 font-extrabold text-3xl sm:text-4xl tracking-tight">
                        {current.salePrice.toLocaleString()} <span className="text-lg sm:text-xl">DH</span>
                      </span>
                    )}
                  </div>
                  {current.discountPercentage && (
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                        <Tag className="h-4 w-4" />
                        -{Math.round(current.discountPercentage)}%
                      </span>
                      {current.discountAmount && (
                        <span className="text-sm text-red-600 font-medium">
                          Économisez {current.discountAmount.toLocaleString()} DH
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {(current.product.slug ?? current.product.id ?? current.productId) && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/produit/${current.product.slug ?? current.product.id ?? current.productId}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white hover:bg-gray-700 transition-colors"
                    >
                      <History className="h-4 w-4" />
                      Fiche produit · Historique des prix
                    </Link>
                    <span className="inline-flex items-center rounded-xl border border-gray-200 px-2">
                      <AddToListButton compact slug={current.product.slug ?? current.product.id ?? current.productId ?? ""} />
                    </span>
                  </div>
                )}

                {/* Fact grid — missing info shows "—" instead of hiding the row */}
                <dl className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 border-y border-gray-100 py-4">
                  <div>
                    <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Prix</dt>
                    <dd className="text-sm font-bold text-gray-900 mt-0.5">
                      {current.salePrice != null ? `${current.salePrice.toLocaleString()} DH` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Réduction</dt>
                    <dd className="text-sm font-bold text-gray-900 mt-0.5">
                      {current.discountPercentage != null ? (
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <Tag className="h-3 w-3" />
                          -{Math.round(current.discountPercentage)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Type promo</dt>
                    <dd className="text-sm text-gray-700 mt-0.5">
                      {current.discountPercentage != null ? "Réduction" : "Offre"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Marque</dt>
                    <dd className="text-sm text-gray-700 mt-0.5">{current.product.brand || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Catégorie</dt>
                    <dd className="text-sm text-blue-600 font-medium mt-0.5">{current.product.category}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Magasin</dt>
                    <dd className="text-sm text-gray-700 mt-0.5">Marjane</dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {current.installmentAmount && current.installmentMonths && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Paiement</p>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">
                        {current.installmentAmount.toLocaleString()} DH/mois × {current.installmentMonths} mois
                      </p>
                    </div>
                  )}
                  {current.availability && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Disponibilité</p>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{current.availability}</p>
                    </div>
                  )}
                </div>

                {current.conditions && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-yellow-700 uppercase tracking-wide mb-1">Conditions</p>
                    <p className="text-sm text-yellow-800">{current.conditions}</p>
                  </div>
                )}

                {features.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Promotions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map((f, i) => (
                        <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {specs && specs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Spécifications</p>
                    <ul className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                      {specs.map((spec, i) => (
                        <li key={i} className="flex items-center gap-2.5 px-3.5 py-2.5">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-3 w-3 text-green-700" strokeWidth={3} />
                          </span>
                          {spec.key ? (
                            <>
                              <span className="text-xs text-gray-500">{spec.key}</span>
                              <span className="text-sm text-gray-900 font-semibold ml-auto text-right">{spec.value}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-900 font-medium">{spec.value}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-5">
                  <AlertSubscribe source={variant === "sheet" ? "offer-sheet" : "offer-dialog"} />
                </div>

                {siblings.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-900 mb-1">
                      Autres promotions intéressantes
                    </p>
                    <p className="text-xs text-gray-400 mb-3">Dans la même catégorie</p>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                      {siblings.map((rel) => (
                        <button
                          key={rel.id}
                          onClick={() => switchOffer(rel)}
                          className="shrink-0 w-44 text-left bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl p-2.5 transition-colors"
                        >
                          <div className="w-full h-20 rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center mb-2">
                            {rel.product.imageUrl && toImageUrl(rel.product.imageUrl) ? (
                              <img
                                src={toImageUrl(rel.product.imageUrl)!}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Package className="h-7 w-7 text-gray-300" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2 min-h-8">
                            {rel.product.name}
                          </p>
                          <p className="mt-1 flex items-baseline gap-1">
                            {rel.salePrice != null && (
                              <span className="text-sm font-extrabold text-gray-900">
                                {rel.salePrice.toLocaleString()} DH
                              </span>
                            )}
                            {rel.discountPercentage != null && (
                              <span className="text-[11px] font-bold text-red-600">
                                -{Math.round(rel.discountPercentage)}%
                              </span>
                            )}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
                  Les informations et les prix sont donnés à titre indicatif. En cas de différence, le catalogue officiel fait foi.
                </p>
              </div>
            </div>
          </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
