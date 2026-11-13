"use client";

import type { Curve } from "@/lib/curve";
import { yieldAt } from "@/lib/curve";
import { useWidth } from "../useWidth";

const INK = "#18201c";
const GRID = "#cfd9c8";
const MUTED = "#7a857e";
const GREEN = "#2f5d46";

/**
 * The Treasury curve on a square-root time axis, so the short end (where
 * most options live) isn't squeezed into the corner. The dot marks the
 * yield this option uses.
 */
export function YieldCurve({ curve, years, used }: { curve: Curve; years: number; used: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 190, L = 46, R = 14, T = 22, B = 28;
  const pts = curve.points;
  const rates = pts.map((p) => p.rate);
  const lo = Math.floor((Math.min(...rates, used) - 0.0015) * 400) / 400;
  const hi = Math.ceil((Math.max(...rates, used) + 0.0015) * 400) / 400;
  const sx = (y: number) => L + ((W - L - R) * Math.sqrt(y)) / Math.sqrt(30);
  const sy = (r: number) => T + (H - T - B) * (1 - (r - lo) / (hi - lo || 1));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += 0.0025) ticks.push(Number(v.toFixed(4)));
  const step = ticks.length > 6 ? 2 : 1;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.years).toFixed(1)},${sy(p.rate).toFixed(1)}`).join("");
  const at = yieldAt(curve, years);
  const shown = new Set(["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"]);
  const days = Math.round(years * 365);
  const yrs = Number(years.toFixed(1));
  const label = days < 360 ? `${days} days` : yrs === 1 ? "1 year" : `${yrs} years`;

  return (
    <div className="curve-box" ref={ref}>
      <div className="curve-head">
        <span>Treasury yield curve, {new Date(curve.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Treasury yields from 1 month to 30 years. This option uses ${(used * 100).toFixed(2)}% for ${label}.`}>
        {ticks.filter((_, i) => i % step === 0).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke={GRID} />
            <text x={L - 7} y={sy(v) + 4} textAnchor="end" fontSize="10.5" fill={MUTED} fontFamily="var(--mono)">{(v * 100).toFixed(2)}%</text>
          </g>
        ))}
        {pts.filter((p) => shown.has(p.short)).map((p) => (
          <text key={p.id} x={sx(p.years)} y={H - 9} textAnchor="middle" fontSize="10.5" fill={MUTED} fontFamily="var(--mono)">{p.short}</text>
        ))}
        <path d={path} fill="none" stroke={INK} strokeWidth={2} />
        {pts.map((p) => <circle key={p.id} cx={sx(p.years)} cy={sy(p.rate)} r={2.5} fill={INK} />)}
        {at && (
          <g>
            <line x1={sx(years)} x2={sx(years)} y1={sy(at.rate)} y2={H - B} stroke={GREEN} strokeDasharray="3 3" />
            <circle cx={sx(years)} cy={sy(at.rate)} r={6} fill={GREEN} stroke="#f7f9f3" strokeWidth={2} />
            <text
              x={Math.min(Math.max(sx(years), L + 60), W - R - 60)}
              y={Math.max(sy(at.rate) - 12, 12)}
              textAnchor="middle" fontSize="11" fontWeight={700} fill={GREEN}
              stroke="#f7f9f3" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke"
            >
              {label}: {(at.rate * 100).toFixed(2)}%
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
