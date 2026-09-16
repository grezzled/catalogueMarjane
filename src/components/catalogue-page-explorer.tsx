"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Package } from "lucide-react";
import OfferModal from "@/components/offer-modal";

export interface ExplorerPage {
  pageNumber: number;
  imageUrl: string | null;
  category: string | null;
}

export interface ExplorerOffer {
  id: string;
  productId: string;
  originalPrice: number | null;
  salePrice: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  installmentAmount: number | null;
  installmentMonths: number | null;
  availability: string | null;
  conditions: string | null;
  promotionalDates: string | null;
  startDate: string;
  endDate: string;
  product: {
    name: string;
    category: string;
    brand: string | null;
    subcategory: string | null;
    specifications: string | null;
    imageUrl: string | null;
  };
  cataloguePage: {
    pageNumber: number;
    imagePath: string | null;
  } | null;
}

export interface Hotspot {
  pageNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
  productId: string;
}

interface Props {
  title: string;
  catalogueSlug: string;
  pages: ExplorerPage[];
  offers: ExplorerOffer[];
  hotspots?: Hotspot[];
}

function toImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const idx = imagePath.indexOf("uploads/");
  return idx !== -1 ? "/" + imagePath.slice(idx) : imagePath;
}

/**
 * Page-by-page explorer: catalogue page on the left, the category and
 * products of the current page on the right. Tapping a product opens a
 * bottom sheet with its full details. No navigation — the user stays put.
 *
 * Deep links: /catalogue-marjane/{slug}#page-N opens the viewer on page N
 * (used by article "Voir page X" links).
 */
export default function CataloguePageExplorer({ title, catalogueSlug, pages, offers, hotspots = [] }: Props) {
  const viewable = useMemo(() => pages.filter((p) => p.imageUrl), [pages]);
  const [index, setIndex] = useState(0);
  // Offer opened by tapping a hotspot on the page image.
  const [hotspotOfferId, setHotspotOfferId] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const offersByPage = useMemo(() => {
    const map = new Map<number, ExplorerOffer[]>();
    for (const o of offers) {
      const pn = o.cataloguePage?.pageNumber;
      if (pn == null) continue;
      const list = map.get(pn) ?? [];
      list.push(o);
      map.set(pn, list);
    }
    return map;
  }, [offers]);
  const offerByProductId = useMemo(() => new Map(offers.map((o) => [o.productId, o])), [offers]);

  // First page index of each category → chips jump straight there.
  // Null/"Other" pages merge into a single "Autres pages" chip.
  const groupLabel = (category: string | null) =>
    !category || category === "Other" ? "Autres pages" : category;

  const categoryJumps = useMemo(() => {
    const seen = new Map<string, number>();
    viewable.forEach((p, i) => {
      const label = groupLabel(p.category);
      if (!seen.has(label)) seen.set(label, i);
    });
    return [...seen.entries()];
  }, [viewable]);

  const prev = useCallback(() => setIndex((i) => (i - 1 + viewable.length) % viewable.length), [viewable.length]);
  // Coach button: visible on every load until the user taps any hotspot.
  const [coachDone, setCoachDone] = useState(false);
  function dismissCoach() {
    setCoachDone(true);
  }
  const next = useCallback(() => setIndex((i) => (i + 1) % viewable.length), [viewable.length]);
  const goTo = useCallback((i: number) => setIndex(Math.min(Math.max(i, 0), viewable.length - 1)), [viewable.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault();
      if (e.key === "ArrowLeft") prev();
      else next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  // Deep-link entry (#page-N, used by article "Voir page X" links): jump the
  // viewer to the linked page and bring it into view after first paint (kept
  // out of render/init so hydration matches the server).
  // The section already carries scroll-mt for the sticky navbar.
  useEffect(() => {
    const m = window.location.hash.match(/^#page-(\d+)$/);
    if (!m) return;
    const raf = requestAnimationFrame(() => {
      const i = viewable.findIndex((p) => p.pageNumber === parseInt(m[1], 10));
      if (i < 0) return;
      setIndex(i);
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (viewable.length === 0) return null;

  const current = viewable[index];
  const pageOffers = offersByPage.get(current.pageNumber) ?? [];
  const pageHotspots = hotspots.filter((h) => h.pageNumber === current.pageNumber);
  const biggestHotspot =
    pageHotspots.length > 0
      ? pageHotspots.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b))
      : null;
  const hotspotOffer = hotspotOfferId ? (offerByProductId.get(hotspotOfferId) ?? null) : null;
  const progress = ((index + 1) / viewable.length) * 100;

  return (
    <section ref={sectionRef} id="lecture" aria-label={`Explorer ${title}`} className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
        <h2 className="text-base font-bold text-gray-900 shrink-0">Explorer</h2>
        <span className="text-xs text-gray-400 tabular-nums shrink-0">
          Page {current.pageNumber}/{viewable[viewable.length - 1].pageNumber}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Left: the catalogue page */}
        <div className="flex-1 min-w-0 w-full">
          <div
            className="relative bg-gray-900 rounded-2xl overflow-hidden touch-pan-y"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current == null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) {
                if (dx > 0) prev();
                else next();
              }
            }}
          >
            {/* Desktop jumpers, top-right inside the view (mobile uses the bar below) */}
            <div className="absolute top-3 right-3 z-20 hidden sm:flex items-center gap-1.5">
              {categoryJumps.length > 1 && (
                <div className="relative">
                  <select
                    aria-label="Aller à une catégorie"
                    value={groupLabel(viewable[index].category)}
                    onChange={(e) => {
                      const found = categoryJumps.find(([label]) => label === e.target.value);
                      if (found) goTo(found[1]);
                    }}
                    className="appearance-none bg-black/50 backdrop-blur-sm border border-white/20 rounded-full pl-3 pr-8 py-1.5 text-xs font-semibold text-white hover:bg-black/70 focus:outline-none cursor-pointer truncate max-w-[200px]"
                  >
                    {categoryJumps.map(([label]) => (
                      <option key={label} value={label} className="text-gray-900">
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3.5 w-3.5 text-white/70 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              )}
              <div className="relative">
                <select
                  aria-label="Aller à une page"
                  value={index}
                  onChange={(e) => goTo(Number(e.target.value))}
                  className="appearance-none bg-black/50 backdrop-blur-sm border border-white/20 rounded-full pl-3 pr-8 py-1.5 text-xs font-semibold tabular-nums text-white hover:bg-black/70 focus:outline-none cursor-pointer"
                >
                  {viewable.map((p, i) => (
                    <option key={p.pageNumber} value={i} className="text-gray-900">
                      {p.pageNumber}/{viewable[viewable.length - 1].pageNumber}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-white/70 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
            <div className="flex items-center justify-center min-h-[420px] sm:min-h-[560px] max-h-[85vh] p-1.5 sm:p-6">
              {/* shrink-wrapped so hotspot % coords map exactly onto the image */}
              <div className="relative inline-block max-w-full">
                <img
                  key={current.pageNumber}
                  src={current.imageUrl!}
                  alt={`${title} — page ${current.pageNumber}`}
                  className="max-w-full max-h-[80vh] w-auto object-contain rounded-lg shadow-2xl"
                />
                {pageHotspots.map((h) => {
                  const spotOffer = offerByProductId.get(h.productId);
                  if (!spotOffer) return null;
                  const label =
                    spotOffer.salePrice != null
                      ? `${spotOffer.salePrice.toLocaleString()} DH`
                      : spotOffer.discountPercentage != null
                        ? `-${Math.round(spotOffer.discountPercentage)}%`
                        : "Voir";
                  // Breathe the zone outward so the frame floats off the product.
                  const M = 0.009;
                  const zx = Math.max(0, h.x - M);
                  const zy = Math.max(0, h.y - M);
                  const zw = Math.min(1 - zx, h.w + M * 2);
                  const zh = Math.min(1 - zy, h.h + M * 2);
                  return (
                    <button
                      key={`${h.pageNumber}-${h.productId}`}
                      onClick={() => { setHotspotOfferId(spotOffer.productId); dismissCoach(); }}
                      aria-label={`Voir ${spotOffer.product.name} — ${label}`}
                      className="group absolute z-10 rounded-[4px] bg-red-500/0 transition-colors hover:bg-red-500/10 focus-visible:bg-red-500/10 focus:outline-none"
                      style={{ left: `${zx * 100}%`, top: `${zy * 100}%`, width: `${zw * 100}%`, height: `${zh * 100}%` }}
                    >
                      <svg
                        aria-hidden
                        className="absolute inset-0 h-full w-full"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                      >
                        <rect x="1.5" y="1.5" width="97" height="97" rx="5" fill="none" stroke="#facc15" strokeWidth="2" opacity="0.95" vectorEffect="non-scaling-stroke" />
                        <rect className="hotspot-ants" x="1.5" y="1.5" width="97" height="97" rx="5" fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="9 5" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <span className="absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block group-focus:block">
                        {label}
                      </span>
                    </button>
                  );
                })}
                {/* One-time coach bubble — inside the shrink-wrapped image box so % coords map exactly onto the image */}
                {!coachDone && biggestHotspot && (() => {
                  const coachOffer = offerByProductId.get(biggestHotspot.productId);
                  if (!coachOffer) return null;
                  const cx = Math.min(80, Math.max(20, (biggestHotspot.x + biggestHotspot.w / 2) * 100));
                  const nearTop = biggestHotspot.y < 0.15;
                  return (
                    <button
                      onClick={() => { setHotspotOfferId(coachOffer.productId); dismissCoach(); }}
                      aria-label={`Voir ${coachOffer.product.name}`}
                      className={`absolute z-20 -translate-x-1/2 animate-bounce flex flex-col items-center ${nearTop ? "" : "-translate-y-full"}`}
                      style={{
                        left: `${cx}%`,
                        top: nearTop
                          ? `${((biggestHotspot.y + biggestHotspot.h) * 100).toFixed(2)}%`
                          : `${(biggestHotspot.y * 100).toFixed(2)}%`,
                        marginTop: nearTop ? "8px" : "-8px",
                      }}
                    >
                      {nearTop && (
                        <span className="mx-auto block h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-white" />
                      )}
                      <span className="block whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-extrabold text-red-600 shadow-2xl ring-2 ring-red-500">
                        Cliquez-moi !
                      </span>
                      {!nearTop && (
                        <span className="mx-auto block h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-white" />
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
            <button
              onClick={prev}
              aria-label="Page précédente"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/25 backdrop-blur-sm w-11 h-11 rounded-full hidden sm:flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              aria-label="Page suivante"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/25 backdrop-blur-sm w-11 h-11 rounded-full hidden sm:flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Thumb-friendly controls: arrows + jumpers, nothing over the products */}
          <div className="mt-3 flex items-center gap-1.5 sm:hidden">
            <button
              onClick={prev}
              aria-label="Page précédente"
              className="shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1 min-w-0">
              <select
                aria-label="Aller à une page"
                value={index}
                onChange={(e) => goTo(Number(e.target.value))}
                className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-2.5 pr-7 py-2 text-xs font-semibold tabular-nums text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
              >
                {viewable.map((p, i) => (
                  <option key={p.pageNumber} value={i}>
                    Page {p.pageNumber} / {viewable[viewable.length - 1].pageNumber}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
            </div>
            {categoryJumps.length > 1 && (
              <div className="relative flex-1 min-w-0">
                <select
                  aria-label="Aller à une catégorie"
                  value={groupLabel(viewable[index].category)}
                  onChange={(e) => {
                    const found = categoryJumps.find(([label]) => label === e.target.value);
                    if (found) goTo(found[1]);
                  }}
                  className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-2.5 pr-7 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
                >
                  {categoryJumps.map(([label]) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
              </div>
            )}
            <button
              onClick={next}
              aria-label="Page suivante"
              className="shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

        </div>

        {/* Right: category + products of the current page */}
        <div className="w-full lg:w-[380px] shrink-0 bg-white border border-gray-200 rounded-2xl p-4 lg:sticky lg:top-20 max-h-none lg:max-h-[85vh] flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900">
              Page {current.pageNumber}
            </h3>
            {current.category && current.category !== "Other" && (
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                {current.category}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {pageOffers.length} produit{pageOffers.length !== 1 ? "s" : ""} sur cette page — touchez un produit pour le détail
          </p>
          <div className="space-y-2 overflow-y-auto pr-0.5">
            {pageOffers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucun produit extrait sur cette page.
              </p>
            )}
            {pageOffers.map((offer) => (
              <OfferModal
                key={offer.id}
                offer={offer}
                catalogueSlug={catalogueSlug}
                catalogueTitle={title}
                variant="sheet"
                relatedOffers={offers.filter(
                  (o) => o.id !== offer.id && o.product.category === offer.product.category
                )}
              >
                <div className="flex items-center gap-3 bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl p-2.5 transition-colors text-left w-full">
                  <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                    {offer.product.imageUrl && toImageUrl(offer.product.imageUrl) ? (
                      <img
                        src={toImageUrl(offer.product.imageUrl)!}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                      {offer.product.name}
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      {offer.originalPrice != null && (
                        <span className="text-xs text-gray-400 line-through">
                          {offer.originalPrice.toLocaleString()} DH
                        </span>
                      )}
                      {offer.salePrice != null && (
                        <span className="text-sm font-extrabold text-red-600">
                          {offer.salePrice.toLocaleString()} DH
                        </span>
                      )}
                      {offer.discountPercentage != null && (
                        <span className="text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                          -{Math.round(offer.discountPercentage)}%
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </div>
              </OfferModal>
            ))}
          </div>
        </div>
      </div>

      {/* Hotspot sheet — opened by tapping a price on the page image */}
      {hotspotOffer && (
        <OfferModal
          offer={hotspotOffer}
          catalogueSlug={catalogueSlug}
          catalogueTitle={title}
          variant="sheet"
          open={hotspotOfferId !== null}
          onOpenChange={(next) => { if (!next) setHotspotOfferId(null); }}
          relatedOffers={offers.filter(
            (o) => o.id !== hotspotOffer.id && o.product.category === hotspotOffer.product.category
          )}
        >
          <span className="hidden" aria-hidden />
        </OfferModal>
      )}
    </section>
  );
}
