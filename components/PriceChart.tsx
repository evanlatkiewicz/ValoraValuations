"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketData } from "@/lib/market";
import { fmtDate } from "@/lib/market";

const LINE = "#2b5aa0";
const VALUE = "#2f5d46";
const INK = "#18201c";
const GRID = "#cfd9c8";
const MUTED = "#7a857e";

const dollars = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: n < 100 ? 2 : 0 })}`;

function niceTicks(lo: number, hi: number, n = 5) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const p = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= step0) ?? 10 * p;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

/** Share price history with the model's value drawn across it. */
export function PriceChart({ data, value, ticker }: { data: MarketData; value: number; ticker: string }) {
  const [period, setPeriod] = useState<"1Y" | "5Y">("1Y");
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = useMemo(() => {
    const last = new Date(data.last.d + "T00:00:00Z");
    last.setUTCFullYear(last.getUTCFullYear() - (period === "1Y" ? 1 : 5));
    const from = last.toISOString().slice(0, 10);
    return data.bars.filter((b) => b.d > from);
  }, [data, period]);

  // Draw at the real width so text stays readable on phones
  const narrow = width < 560;
  const W = Math.max(300, width), H = narrow ? 240 : 300, L = narrow ? 46 : 60, R = narrow ? 92 : 120, T = 16, B = 30;
  const showValue = Number.isFinite(value) && value > 0;
  const vals = bars.map((b) => b.c);
  const lo0 = Math.min(...vals, showValue ? value : Infinity);
  const hi0 = Math.max(...vals, showValue ? value : -Infinity);
  const ticks = niceTicks(lo0 * 0.97, hi0 * 1.03);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, bars.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const path = bars.map((b, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b.c).toFixed(1)}`).join("");

  // About six date labels along the bottom
  const labelEvery = Math.max(1, Math.round(bars.length / (narrow ? 3 : 6)));
  const dateLabel = (d: string) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: period === "5Y" ? "numeric" : "2-digit", timeZone: "UTC" });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (bars.length - 1));
    setHover(Math.max(0, Math.min(bars.length - 1, i)));
  };

  const h = hover !== null ? bars[hover] : null;
  const valueY = showValue ? y(value) : 0;
  const lastY = y(data.last.c);
  // Keep the two right-edge labels from overlapping
  const sep = Math.abs(valueY - lastY) < 18;

  return (
    <div className="chart-box price-box" ref={box}>
      <div className="price-head">
        <div>
          <h3>{ticker} share price and your value</h3>
          <p>
            Daily closing prices. The dashed line is your DCF value of {showValue ? dollars(value) : "n/a"} per share.
          </p>
        </div>
        <div className="seg seg-small" role="group" aria-label="Time period">
          {(["1Y", "5Y"] as const).map((p) => (
            <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{p === "1Y" ? "1 year" : "5 years"}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ticker} daily closing price over ${period === "1Y" ? "one year" : "five years"}, with the DCF value marked`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{dollars(t)}</text>
          </g>
        ))}
        {bars.map((b, i) =>
          i % labelEvery === 0 && i < bars.length - labelEvery / 2 ? (
            <text key={b.d} x={x(i)} y={H - 8} fontSize="11" fill={MUTED} textAnchor="middle">{dateLabel(b.d)}</text>
          ) : null,
        )}
        <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />
        {showValue && (
          <g>
            <line x1={L} x2={W - R} y1={valueY} y2={valueY} stroke={VALUE} strokeWidth={2} strokeDasharray="6 5" />
            <text x={W - R + 8} y={valueY + (sep && valueY < lastY ? -4 : 4) + (sep && valueY >= lastY ? 8 : 0)} fontSize="12" fill={INK} fontWeight={700}>
              {narrow ? "Value" : "Your value"} {dollars(value)}
            </text>
          </g>
        )}
        <circle cx={x(bars.length - 1)} cy={lastY} r={4} fill={LINE} stroke="#f7f9f3" strokeWidth={2} />
        <text x={W - R + 8} y={lastY + (sep && lastY <= valueY ? -4 : 4) + (sep && lastY > valueY ? 8 : 0)} fontSize="12" fill={INK}>
          Last {dollars(data.last.c)}
        </text>
        {h && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={INK} strokeWidth={1} opacity={0.35} />
            <circle cx={x(hover)} cy={y(h.c)} r={4.5} fill={LINE} stroke="#f7f9f3" strokeWidth={2} />
            <g transform={`translate(${Math.min(Math.max(x(hover) - 70, L), W - R - 140)},${T})`}>
              <rect width="140" height="44" rx="3" fill={INK} />
              <text x="10" y="18" fill="#f7f9f3" fontSize="11">{fmtDate(h.d)}</text>
              <text x="10" y="35" fill="#f7f9f3" fontSize="13" fontFamily="var(--mono)">{dollars(h.c)}</text>
            </g>
          </g>
        )}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={onMove} />
      </svg>
      <div className="price-stats">
        <span>52-week range <strong className="num">{dollars(data.low52)} to {dollars(data.high52)}</strong></span>
        <span>Last close <strong className="num">{dollars(data.last.c)}</strong> on {fmtDate(data.last.d)}</span>
        {showValue && (
          <span>
            Your value is{" "}
            <strong>
              {value < data.low52 ? "below the 52-week low" : value > data.high52 ? "above the 52-week high" : "inside the 52-week range"}
            </strong>
          </span>
        )}
        <span className="faint">Prices from {data.source}, based on closing prices</span>
      </div>
    </div>
  );
}
