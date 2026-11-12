"use client";

import { useState } from "react";
import { moneyB } from "@/lib/format";

// Colors validated with the dataviz palette checker (CVD and contrast pass).
export const C_FCF = "#3f8a55";
export const C_PV = "#2b5aa0";
const C_SUB = "#b0281f";
const C_TOTAL = "#18201c";

/** Rounded top on a bar anchored to a baseline (4px data-end). */
function barPath(x: number, y: number, w: number, h: number, up = true) {
  const r = Math.min(4, Math.abs(h), w / 2);
  if (h <= 0) return "";
  return up
    ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
    : `M${x},${y} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w - r} Q${x + w},${y + h} ${x + w},${y + h - r} V${y} Z`;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return (steps.find((s) => m <= s) ?? 10) * p;
}

function Tip({ x, y, lines, width }: { x: number; y: number; lines: string[]; width: number }) {
  const w = 170;
  const tx = Math.min(Math.max(x - w / 2, 4), width - w - 4);
  return (
    <g pointerEvents="none">
      <rect x={tx} y={y} width={w} height={14 + lines.length * 16} rx="3" fill="#18201c" />
      {lines.map((l, i) => (
        <text key={i} x={tx + 10} y={y + 19 + i * 16} fill="#f7f9f3" fontSize="12" fontFamily="var(--mono)">{l}</text>
      ))}
    </g>
  );
}

/** Projected free cash flow next to what it's worth today. */
export function FcfChart({ labels, fcf, pv }: { labels: string[]; fcf: number[]; pv: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 260, L = 56, R = 8, T = 16, B = 30;
  const max = niceMax(Math.max(...fcf, ...pv, 0));
  const y = (v: number) => T + (H - T - B) * (1 - Math.max(0, v) / max);
  const band = (W - L - R) / labels.length;
  const bw = Math.min(22, band / 3.2);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected free cash flow and present value by year" onMouseLeave={() => setHover(null)}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#cfd9c8" strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7a857e" fontFamily="var(--mono)">{moneyB(t)}</text>
        </g>
      ))}
      {labels.map((lab, i) => {
        const cx = L + band * i + band / 2;
        return (
          <g key={lab}>
            <path d={barPath(cx - bw - 1, y(fcf[i]), bw, y(0) - y(fcf[i]))} fill={C_FCF} />
            <path d={barPath(cx + 1, y(pv[i]), bw, y(0) - y(pv[i]))} fill={C_PV} />
            <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill="#4a5650">{lab}</text>
            <rect x={cx - band / 2} y={T} width={band} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${lab}: free cash flow ${moneyB(fcf[i])}, present value ${moneyB(pv[i])}`} />
          </g>
        );
      })}
      {hover !== null && (
        <Tip x={L + band * hover + band / 2} y={T} width={W} lines={[labels[hover], `FCF  ${moneyB(fcf[hover])}`, `PV   ${moneyB(pv[hover])}`]} />
      )}
    </svg>
  );
}

export interface Step {
  label: string;
  value: number;
  kind: "add" | "sub" | "total";
}

/** Waterfall from PV of cash flows to equity value. */
export function Waterfall({ steps }: { steps: Step[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 260, L = 56, R = 8, T = 22, B = 44;
  let run = 0;
  const bars = steps.map((s) => {
    let from: number, to: number;
    if (s.kind === "total") {
      from = 0; to = s.value; run = s.value;
    } else if (s.kind === "add") {
      from = run; to = run + s.value; run = to;
    } else {
      from = run; to = run - s.value; run = to;
    }
    return { ...s, lo: Math.min(from, to), hi: Math.max(from, to), end: run };
  });
  const max = niceMax(Math.max(...bars.map((b) => b.hi)));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const band = (W - L - R) / steps.length;
  const bw = Math.min(54, band * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const color = (k: Step["kind"]) => (k === "add" ? C_FCF : k === "sub" ? C_SUB : C_TOTAL);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bridge from discounted cash flows to equity value" onMouseLeave={() => setHover(null)}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#cfd9c8" strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7a857e" fontFamily="var(--mono)">{moneyB(t)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = L + band * i + (band - bw) / 2;
        const next = bars[i + 1];
        return (
          <g key={b.label}>
            <rect x={x} y={y(b.hi)} width={bw} height={Math.max(1, y(b.lo) - y(b.hi))} rx="2" fill={color(b.kind)} />
            {next && next.kind !== "total" && (
              <line x1={x + bw} x2={x + band} y1={y(b.end)} y2={y(b.end)} stroke="#7a857e" strokeDasharray="2 3" />
            )}
            <text x={x + bw / 2} y={y(b.hi) - 6} textAnchor="middle" fontSize="11" fill="#18201c" fontFamily="var(--mono)">
              {b.kind === "sub" ? `(${moneyB(b.value)})` : moneyB(b.value)}
            </text>
            {b.label.split("\n").map((ln, j) => (
              <text key={j} x={x + bw / 2} y={H - 26 + j * 13} textAnchor="middle" fontSize="11" fill="#4a5650">{ln}</text>
            ))}
            <rect x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        );
      })}
      {hover !== null && (
        <Tip x={L + band * hover + band / 2} y={2} width={W} lines={[bars[hover].label.replace("\n", " "), `${bars[hover].kind === "sub" ? "−" : bars[hover].kind === "add" ? "+" : "="} ${moneyB(bars[hover].value)}`]} />
      )}
    </svg>
  );
}
