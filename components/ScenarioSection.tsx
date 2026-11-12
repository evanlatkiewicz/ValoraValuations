"use client";

import { useState } from "react";
import type { Ctx } from "./Valora";
import { Stars } from "./ui";
import { useWidth } from "./useWidth";
import { sensitivity } from "@/lib/dcf";
import { mult, pct, price, signedPct } from "@/lib/format";
import { getScenarios, SCENARIO_IDS, SCENARIO_LABEL, type ScenarioId } from "@/lib/scenarios";

const COLOR: Record<ScenarioId, string> = { bear: "#b0281f", base: "#18201c", bull: "#2f5d46" };
const GRID = "#cfd9c8";
const MUTED = "#7a857e";
const INK = "#18201c";
const PRICE_C = "#2b5aa0";

const short = (n: number) =>
  !Number.isFinite(n) ? "n/a" : `$${Math.abs(n) >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(Math.abs(n) < 100 ? 2 : 0)}`;

function niceScale(lo: number, hi: number, n = 5) {
  const span = hi - lo || Math.abs(hi) || 1;
  const step0 = span / n;
  const p = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= step0) ?? 10 * p;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function ScenarioSection({ ctx }: { ctx: Ctx }) {
  const a = ctx.analysis;
  const inp = ctx.raw;
  const [ffRef, ffW] = useWidth<HTMLDivElement>();
  const [prRef, prW] = useWidth<HTMLDivElement>();
  const [drRef, drW] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  if (!a) return null;

  const mkt = inp.sharePrice;
  const w = getScenarios(inp).weights;
  const wSum = w.bear + w.base + w.bull;
  const setW = (id: ScenarioId, v: number) => ctx.setWeights({ ...w, [id]: Math.max(0, v) });
  const edit = (id: ScenarioId) => {
    ctx.setScenario(id);
    ctx.go("inputs", 1);
  };

  // ---- Football field rows ----
  const baseIn = a.cases.base.inputs;
  const gordon = baseIn.terminalMethod === "gordon";
  const sens = sensitivity(baseIn, [-0.01, 0, 0.01], gordon ? [-0.01, 0, 0.01] : [-4, 0, 4]);
  const sensVals = sens.prices.flat().filter((x) => Number.isFinite(x));
  const caseVals = SCENARIO_IDS.map((id) => a.cases[id].value);
  const rows: { label: string; sub: string; lo: number; hi: number; color: string }[] = [
    { label: "Your cases", sub: "Bear to bull", lo: Math.min(...caseVals), hi: Math.max(...caseVals), color: "#3f8a55" },
    { label: "Weighted value ± 1 std. dev.", sub: `${short(a.expected)} ± ${short(a.stdev)}`, lo: a.expected - a.stdev, hi: a.expected + a.stdev, color: "#5b7f6a" },
    ...(sensVals.length
      ? [{ label: "Sensitivity", sub: gordon ? "WACC ±1 pt, growth ±1 pt" : "WACC ±1 pt, multiple ±4x", lo: Math.min(...sensVals), hi: Math.max(...sensVals), color: "#8aa98f" }]
      : []),
    ...(ctx.market && ctx.market.ticker === inp.company.ticker.toUpperCase()
      ? [{ label: "52-week trading range", sub: "Closing prices", lo: ctx.market.low52, hi: ctx.market.high52, color: PRICE_C }]
      : []),
  ];

  const narrow = ffW < 560;
  // On phones, labels sit above each bar instead of beside it
  const FL = narrow ? 44 : 210, FR = narrow ? 44 : 24, rowH = narrow ? 64 : 46, FT = 28, barOff = narrow ? 30 : 4;
  const FH = FT + rows.length * rowH + 30;
  const allVals = [...rows.flatMap((r) => [r.lo, r.hi]), mkt].filter(Number.isFinite);
  const fTicks = niceScale(Math.min(...allVals) * 0.95, Math.max(...allVals) * 1.05, narrow ? 3 : 5);
  const fx = (v: number) => FL + ((ffW - FL - FR) * (v - fTicks[0])) / (fTicks[fTicks.length - 1] - fTicks[0]);

  // ---- Probability chart ----
  const PL = 20, PR = 20, PT = 30, PB = 34, PH = 220;
  const pVals = [...caseVals, a.expected, mkt].filter(Number.isFinite);
  const pTicks = niceScale(Math.min(...pVals) * 0.9, Math.max(...pVals) * 1.05);
  const px = (v: number) => PL + ((prW - PL - PR) * (v - pTicks[0])) / (pTicks[pTicks.length - 1] - pTicks[0]);
  const py = (p: number) => PH - PB - (PH - PB - PT) * p;

  // ---- Driver breakdown (tornado) ----
  const drivers = a.drivers.bull.map((d, k) => ({ label: d.label, bull: d.delta, bear: a.drivers.bear[k].delta }));
  const maxAbs = Math.max(1e-9, ...drivers.flatMap((d) => [Math.abs(d.bull), Math.abs(d.bear)]));
  const DL = drW < 560 ? 110 : 160, DR = 70, DT = 26, dRow = 40;
  const DH = DT + drivers.length * dRow + 10;
  const mid = DL + 50 + (drW - DL - DR - 50) / 2;
  const half = (drW - DL - DR - 50) / 2 - 10;
  const dx = (v: number) => mid + (v / maxAbs) * half;
  const top = [...drivers].sort((p, q) => Math.abs(q.bull) + Math.abs(q.bear) - Math.abs(p.bull) - Math.abs(p.bear))[0];
  const gapTotal = a.cases.bull.value - a.cases.bear.value;
  const topShare = gapTotal > 0 ? (top.bull - top.bear) / gapTotal : NaN;

  // ---- Plain-English readings ----
  const spreadWord = a.cv < 0.1 ? "tight" : a.cv < 0.25 ? "moderate" : "wide";
  const skewWord = !Number.isFinite(a.skew) ? "" : a.skew > 1.15 ? "more upside than downside" : a.skew < 0.87 ? "more downside than upside" : "roughly balanced";
  const priceLine =
    a.priceVsRange === "above"
      ? `Today's price of ${price(mkt)} is above even your bull case, so no mix of your three cases explains it. The market is more optimistic than your best case.`
      : a.priceVsRange === "below"
        ? `Today's price of ${price(mkt)} is below even your bear case. Either the market sees risks your cases leave out, or your cases are too optimistic.`
        : `If the only outcomes were your bull and bear cases, today's price implies about a ${pct(a.impliedBullProb ?? NaN, 0)} chance of the bull case.`;

  return (
    <section className="scen" aria-labelledby="scen-title">
      <div className="scen-head">
        <div>
          <h2 id="scen-title" className="section-h" style={{ marginTop: 0 }}>Bull, base and bear</h2>
          <p className="section-p">
            Three versions of the same company. They share the history, balance sheet and discount rate, and differ in growth, margins,
            capex and terminal value. Set how likely you think each one is.
          </p>
        </div>
        {inp.scenarios && (
          <button className="linkbtn" onClick={ctx.resetCases}>Reset bull and bear to starting values</button>
        )}
      </div>

      {/* Case cards */}
      <div className="case-cards">
        {SCENARIO_IDS.map((id) => {
          const c = a.cases[id];
          const ci = c.inputs;
          const up = mkt > 0 ? c.value / mkt - 1 : NaN;
          return (
            <div key={id} className={`case-card case-${id} ${ctx.scenario === id ? "is-active" : ""}`}>
              <div className="case-card-top">
                <span className={`case-tag case-${id === "base" ? "base-tag" : id}`}>{SCENARIO_LABEL[id]}</span>
                <label className="case-weight">
                  <span>Probability</span>
                  <span className="num-input">
                    <input
                      inputMode="decimal"
                      aria-label={`${SCENARIO_LABEL[id]} case probability`}
                      value={Math.round(w[id] * 1000) / 10}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) setW(id, v / 100);
                      }}
                    />
                    <span className="affix post">%</span>
                  </span>
                </label>
              </div>
              <div className={`case-value ${c.value < 0 ? "neg" : ""}`}>{price(c.value)}</div>
              <div className={`num ${up < 0 ? "neg" : ""}`} style={{ fontWeight: 600 }}>{signedPct(up)} vs. market</div>
              <div style={{ marginTop: 8 }}><Stars value={c.stars} size={15} /></div>
              <dl className="case-facts">
                <dt>Revenue growth</dt><dd className="num">{pct(ci.revenueGrowth[0])} to {pct(ci.revenueGrowth[4])}</dd>
                <dt>Operating margin</dt><dd className="num">{pct(ci.ebitMargin[0])} to {pct(ci.ebitMargin[4])}</dd>
                <dt>Capex</dt><dd className="num">{pct(ci.capexPct)} of revenue</dd>
                <dt>{gordon ? "Terminal growth" : "Exit multiple"}</dt><dd className="num">{gordon ? pct(ci.terminalGrowth) : mult(ci.exitMultiple)}</dd>
              </dl>
              <button className="btn ghost small" onClick={() => edit(id)}>Edit {SCENARIO_LABEL[id].toLowerCase()} case</button>
            </div>
          );
        })}
      </div>
      {Math.abs(wSum - 1) > 0.001 && (
        <p className="faint" style={{ fontSize: "var(--step--1)", marginTop: 8 }}>
          Your probabilities add to {pct(wSum, 0)}, so Valora scales them to 100%: {pct(a.weights.bear, 0)} bear, {pct(a.weights.base, 0)} base,{" "}
          {pct(a.weights.bull, 0)} bull.
        </p>
      )}

      {/* Weighted value and stats */}
      <div className="quant">
        <div className="quant-main">
          <div className="cap">Probability-weighted value</div>
          <div className="quant-big">{price(a.expected)}</div>
          <div className={`num ${a.expectedUpside < 0 ? "neg" : ""}`} style={{ fontWeight: 600 }}>{signedPct(a.expectedUpside)} vs. {price(mkt)}</div>
          <p className="formula-mini">
            {pct(a.weights.bear, 0)} × {price(a.cases.bear.value)} + {pct(a.weights.base, 0)} × {price(a.cases.base.value)} + {pct(a.weights.bull, 0)} ×{" "}
            {price(a.cases.bull.value)}
          </p>
        </div>
        <div className="quant-grid">
          <div className="stat">
            <div className="stat-label">Spread of outcomes</div>
            <div className="stat-value">{short(a.stdev)}</div>
            <p>
              Weighted standard deviation, {pct(a.cv, 0)} of the weighted value. Your outcomes are <strong>{spreadWord}</strong>.
            </p>
          </div>
          <div className="stat">
            <div className="stat-label">Upside vs. downside</div>
            <div className="stat-value">{Number.isFinite(a.skew) ? `${a.skew.toFixed(2)}x` : "n/a"}</div>
            <p>
              {short(a.upsideToBull)} from base to bull against {short(a.downsideToBear)} from base to bear{skewWord ? `: ${skewWord}` : ""}.
            </p>
          </div>
          <div className="stat">
            <div className="stat-label">Odds it&rsquo;s worth more than today&rsquo;s price</div>
            <div className="stat-value">{pct(a.probAbovePrice, 0)}</div>
            <p>The combined probability of the cases valued above {price(mkt)}.</p>
          </div>
          <div className="stat">
            <div className="stat-label">What the price implies</div>
            <div className="stat-value">
              {a.impliedBullProb !== null ? `${pct(a.impliedBullProb, 0)} bull` : a.priceVsRange === "above" ? "Above bull" : "Below bear"}
            </div>
            <p>{priceLine}</p>
          </div>
        </div>
      </div>

      {!a.valid && (
        <p className="warn-say" style={{ marginTop: 12 }}>
          At least one case has no meaningful value (terminal growth at or above WACC, or no price). Fix it before relying on these numbers.
        </p>
      )}

      {/* Football field */}
      <div className="chart-box" style={{ marginTop: 24 }} ref={ffRef}>
        <h3>Football field</h3>
        <p>Value per share ranges side by side. The blue line is today&rsquo;s price.</p>
        <svg viewBox={`0 0 ${ffW} ${FH}`} role="img" aria-label="Football field chart comparing value ranges with today's price">
          {fTicks.map((t) => (
            <g key={t}>
              <line x1={fx(t)} x2={fx(t)} y1={FT - 8} y2={FH - 26} stroke={GRID} />
              <text x={fx(t)} y={FH - 8} textAnchor="middle" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{short(t)}</text>
            </g>
          ))}
          {rows.map((r, k) => {
            const y = FT + k * rowH;
            const x1 = fx(r.lo), x2 = fx(r.hi);
            return (
              <g key={r.label} onMouseEnter={() => setHover(r.label)} onMouseLeave={() => setHover(null)}>
                <text x={0} y={y + 14} fontSize={13} fontWeight={700} fill={INK}>{r.label}</text>
                {narrow ? null : <text x={0} y={y + 30} fontSize="11" fill={MUTED}>{r.sub}</text>}
                <rect x={x1} y={y + barOff} width={Math.max(3, x2 - x1)} height={narrow ? 20 : 26} rx={4} fill={r.color} opacity={hover && hover !== r.label ? 0.45 : 1} />
                <text x={x1 - 6} y={y + barOff + (narrow ? 15 : 18)} textAnchor="end" fontSize="11" fill={INK} fontFamily="var(--mono)">{short(r.lo)}</text>
                <text x={x2 + 6} y={y + barOff + (narrow ? 15 : 18)} fontSize="11" fill={INK} fontFamily="var(--mono)">{short(r.hi)}</text>
              </g>
            );
          })}
          {Number.isFinite(mkt) && mkt > 0 && (
            <g>
              <line x1={fx(mkt)} x2={fx(mkt)} y1={FT - 14} y2={FH - 26} stroke={PRICE_C} strokeWidth={2.5} />
              <text x={fx(mkt)} y={FT - 18} textAnchor="middle" fontSize="12" fontWeight={700} fill={PRICE_C}>Price {short(mkt)}</text>
            </g>
          )}
        </svg>
      </div>

      <div className="charts" style={{ marginTop: 24 }}>
        {/* Probability chart */}
        <div className="chart-box" ref={prRef}>
          <h3>Outcomes and their odds</h3>
          <p>Each stem is a case. Its height is the probability you gave it.</p>
          <svg viewBox={`0 0 ${prW} ${PH}`} role="img" aria-label="Case values plotted against their probabilities">
            {[0, 0.25, 0.5, 0.75].map((p) => (
              <g key={p}>
                <line x1={PL} x2={prW - PR} y1={py(p)} y2={py(p)} stroke={GRID} strokeWidth={p === 0 ? 1.5 : 1} />
                {p > 0 && <text x={PL} y={py(p) - 4} fontSize="10" fill={MUTED}>{pct(p, 0)}</text>}
              </g>
            ))}
            {pTicks.map((t) => (
              <text key={t} x={px(t)} y={PH - 12} textAnchor="middle" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{short(t)}</text>
            ))}
            {Number.isFinite(mkt) && mkt > 0 && (
              <g>
                <line x1={px(mkt)} x2={px(mkt)} y1={PT - 10} y2={py(0)} stroke={PRICE_C} strokeWidth={2} />
                <text x={px(mkt)} y={PT - 14} textAnchor="middle" fontSize="11" fontWeight={700} fill={PRICE_C}>Price</text>
              </g>
            )}
            <line x1={px(a.expected)} x2={px(a.expected)} y1={PT - 10} y2={py(0)} stroke={INK} strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={px(a.expected)} y={PT - 14} textAnchor="middle" fontSize="11" fontWeight={700} fill={INK}>Weighted</text>
            {SCENARIO_IDS.map((id) => {
              const c = a.cases[id];
              const x = px(c.value), y = py(c.weight);
              return (
                <g key={id}>
                  <line x1={x} x2={x} y1={py(0)} y2={y} stroke={COLOR[id]} strokeWidth={3} />
                  <circle cx={x} cy={y} r={7} fill={COLOR[id]} stroke="#f7f9f3" strokeWidth={2} />
                  <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight={700} fill={INK}>{SCENARIO_LABEL[id]}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Driver breakdown */}
        <div className="chart-box" ref={drRef}>
          <h3>What moves the value</h3>
          <p>
            Change in value per share as each assumption moves from base to bull (right) or bear (left).
            {Number.isFinite(topShare) && ` ${top.label} accounts for ${pct(topShare, 0)} of the gap between bear and bull.`}
          </p>
          <svg viewBox={`0 0 ${drW} ${DH}`} role="img" aria-label="How much each assumption changes the value between cases">
            <line x1={mid} x2={mid} y1={DT - 10} y2={DH - 4} stroke={INK} strokeWidth={1} />
            <text x={mid - 6} y={DT - 12} textAnchor="end" fontSize="11" fill={COLOR.bear} fontWeight={700}>Bear</text>
            <text x={mid + 6} y={DT - 12} fontSize="11" fill={COLOR.bull} fontWeight={700}>Bull</text>
            {drivers.map((d, k) => {
              const y = DT + k * dRow;
              return (
                <g key={d.label}>
                  <text x={0} y={y + 17} fontSize="12" fill={INK} fontWeight={600}>{d.label}</text>
                  {Math.abs(d.bear) > 1e-9 && <rect x={dx(d.bear)} y={y + 4} width={mid - dx(d.bear)} height={20} rx={3} fill={COLOR.bear} />}
                  {Math.abs(d.bull) > 1e-9 && <rect x={mid} y={y + 4} width={dx(d.bull) - mid} height={20} rx={3} fill={COLOR.bull} />}
                  <text x={Math.min(dx(d.bear), mid) - 5} y={y + 18} textAnchor="end" fontSize="11" fill={INK} fontFamily="var(--mono)">
                    {Math.abs(d.bear) > 0.005 ? `−${short(Math.abs(d.bear))}` : "$0"}
                  </text>
                  <text x={Math.max(dx(d.bull), mid) + 5} y={y + 18} fontSize="11" fill={INK} fontFamily="var(--mono)">
                    {Math.abs(d.bull) > 0.005 ? `+${short(d.bull)}` : "$0"}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="faint" style={{ fontSize: "0.75rem" }}>
            Steps are applied in order (growth, margin, capex, terminal), so they add up exactly to the difference between cases.
          </p>
        </div>
      </div>
    </section>
  );
}
