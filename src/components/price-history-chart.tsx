"use client";

import { useId, useRef, useState } from "react";
import type { PricePoint } from "@/services/products";

/**
 * Price history chart: sale price (solid) + original price (dashed),
 * x-axis linear in time. Hover via getScreenCTM for exact point matching.
 */
export default function PriceHistoryChart({ history }: { history: PricePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number; wrapW: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const W = 680, H = 240, padL = 56, padR = 14, padT = 14, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const pts = history
    .map((h, i) => ({ ...h, t: +new Date(h.date), i }))
    .sort((a, b) => a.t - b.t);
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const tSpan = t1 - t0 || 1;
  const allPrices = pts.flatMap((p) => [p.salePrice, p.originalPrice]).filter((v): v is number => v != null);
  const lo = Math.min(...allPrices);
  const hi = Math.max(...allPrices);
  const pad = (hi - lo || hi || 1) * 0.15;
  const yMin = Math.max(0, lo - pad), yMax = hi + pad;

  const x = (t: number) => padL + ((t - t0) / tSpan) * plotW;
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  function series(get: (p: (typeof pts)[number]) => number | null): string {
    let d = "";
    let started = false;
    for (const p of pts) {
      const v = get(p);
      if (v == null) { started = false; continue; }
      d += `${started ? "L" : "M"}${x(p.t).toFixed(1)},${y(v).toFixed(1)}`;
      started = true;
    }
    return d;
  }

  const ticks = [0, 1, 2, 3, 4].map((t) => yMin + ((yMax - yMin) * t) / 4);
  const fmtTick = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${Math.round(v)}`);
  const labelCount = Math.min(pts.length, 6);
  const labelIdx = pts.map((_, i) => i).filter((i) => i % Math.ceil(pts.length / labelCount) === 0);

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current, wrap = wrapRef.current;
    if (!svg || !wrap) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    let best = 0, bestDist = Infinity;
    pts.forEach((pt, i) => {
      const d = Math.abs(x(pt.t) - p.x);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setHover(best);
    const v = pts[best].salePrice ?? pts[best].originalPrice ?? yMin;
    const dot = new DOMPoint(x(pts[best].t), y(v)).matrixTransform(ctm);
    const wr = wrap.getBoundingClientRect();
    setTipPos({ left: dot.x - wr.left, top: dot.y - wr.top, wrapW: wr.width });
  }

  function onLeave() {
    setHover(null);
    setTipPos(null);
  }

  const hp = hover != null ? pts[hover] : null;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div ref={wrapRef} className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-60 cursor-crosshair" onMouseMove={onMove} onMouseLeave={onLeave}>
        <defs>
          <linearGradient id={`ph-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#9ca3af">{fmtTick(t)} DH</text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(pts[i].t)} y={H - 8} textAnchor="middle" fontSize={11} fill="#9ca3af">
            {fmtDate(pts[i].date)}
          </text>
        ))}
        <path d={`${series((p) => p.salePrice)} L${x(pts[pts.length - 1].t).toFixed(1)},${padT + plotH} L${x(pts[0].t).toFixed(1)},${padT + plotH} Z`} fill={`url(#ph-${gid})`} />
        <path d={series((p) => p.originalPrice)} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={series((p) => p.salePrice)} fill="none" stroke="#dc2626" strokeWidth={2.5} strokeLinejoin="round" />
        {hover != null && (
          <line x1={x(pts[hover].t)} x2={x(pts[hover].t)} y1={padT} y2={padT + plotH} stroke="#dc2626" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        )}
        {pts.map((p, i) =>
          p.salePrice != null ? (
            <circle key={i} cx={x(p.t)} cy={y(p.salePrice)} r={hover === i ? 5 : 3.5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
          ) : null
        )}
      </svg>
      {hp && tipPos && (
        <div
          className="absolute z-10 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          style={{
            left: Math.max(80, Math.min(tipPos.wrapW - 80, tipPos.left)),
            top: Math.max(4, tipPos.top - 8),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold">{fmtDate(hp.date)}</p>
          <p>Prix: <span className="font-bold">{hp.salePrice != null ? `${hp.salePrice.toLocaleString()} DH` : "—"}</span>
            {hp.originalPrice != null && hp.salePrice != null && hp.originalPrice > hp.salePrice && (
              <span className="text-gray-400"> <s>{hp.originalPrice.toLocaleString()}</s></span>
            )}
          </p>
          {hp.discountPercentage != null && hp.discountPercentage > 0 && <p className="text-green-300 font-medium">-{Math.round(hp.discountPercentage)}%</p>}
          <p className="text-gray-300 max-w-48 truncate">{hp.catalogueTitle}{hp.pageNumber != null ? ` · p.${hp.pageNumber}` : ""}</p>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-red-600" /> Prix promo</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-gray-400" /> Prix d&apos;origine</span>
      </div>
    </div>
  );
}
