"use client";

import { useMemo, useState } from "react";
import type { OptCtx } from "./OptionsTool";
import { Dot, Stars } from "../ui";
import { useWidth } from "../useWidth";
import { blackScholes, payoffAtExpiry, priceOf, type Greeks } from "@/lib/options";
import { pct, price } from "@/lib/format";
import { fmtDate } from "@/lib/market";

const CALL_C = "#3f8a55";
const PUT_C = "#2b5aa0";
const INK = "#18201c";
const GRID = "#cfd9c8";
const MUTED = "#7a857e";
const RED = "#b0281f";
const AMBER = "#a86c12";

function niceTicks(lo: number, hi: number, n = 5) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const p = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= step0) ?? 10 * p;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}
const tick = (n: number) => (Number.isInteger(n) ? `${n < 0 ? "−" : ""}$${Math.abs(n)}` : usd(n));
const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(Math.abs(n) >= 100 ? 0 : 2)}`;

/** Profit or loss per share for a buyer, at expiration and today. */
function PayoffChart({ ctx }: { ctx: OptCtx }) {
  const { m, run } = ctx;
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const premium = run.price;
  const lo = Math.min(m.S, m.K) * 0.6, hi = Math.max(m.S, m.K) * 1.4;
  const N = 120;
  const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
  const expiry = xs.map((s) => payoffAtExpiry(m.type, m.K, premium, s));
  const today = xs.map((s) => priceOf({ ...run.inputs, S: s }, m.type) - premium);
  const ymin = Math.min(...expiry, ...today), ymax = Math.max(...expiry, ...today);
  const yt = niceTicks(ymin, ymax);
  const H = 280, L = 56, R = 16, T = 18, B = 32;
  const y0 = Math.min(ymin, yt[0]), y1 = Math.max(ymax, yt[yt.length - 1]);
  const xp = (s: number) => L + ((W - L - R) * (s - lo)) / (hi - lo);
  const yp = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${xp(xs[i]).toFixed(1)},${yp(v).toFixed(1)}`).join("");
  const be = m.type === "call" ? run.breakeven.call : run.breakeven.put;
  const xt = niceTicks(lo, hi, 6);
  const h = hover !== null ? { s: xs[hover], e: expiry[hover], t: today[hover] } : null;

  return (
    <div className="chart-box" ref={ref}>
      <h3>Profit or loss if you buy the {m.type}</h3>
      <p>Per share, for each possible stock price. One contract is 100 shares.</p>
      <div className="legend">
        <span><i style={{ background: INK }} />At expiration</span>
        <span><i style={{ background: AMBER }} />Today, if the stock moved now</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profit or loss chart" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * W;
          const i = Math.round(((px - L) / (W - L - R)) * N);
          setHover(i >= 0 && i <= N ? i : null);
        }}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yp(v)} y2={yp(v)} stroke={v === 0 ? INK : GRID} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={L - 8} y={yp(v) + 4} textAnchor="end" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{tick(v)}</text>
          </g>
        ))}
        {xt.map((v) => <text key={v} x={xp(v)} y={H - 10} textAnchor="middle" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{tick(v)}</text>)}
        <line x1={xp(m.S)} x2={xp(m.S)} y1={T} y2={H - B} stroke={MUTED} strokeDasharray="3 4" />
        <text x={xp(m.S) + 4} y={T + 10} fontSize="11" fill={MUTED}>Today {usd(m.S)}</text>
        {be > lo && be < hi && (
          <g>
            <circle cx={xp(be)} cy={yp(0)} r={5} fill={INK} stroke="#f7f9f3" strokeWidth={2} />
            <text x={xp(be)} y={yp(0) - 10} textAnchor="middle" fontSize="11" fontWeight={700} fill={INK}>Breakeven {usd(be)}</text>
          </g>
        )}
        <path d={path(today)} fill="none" stroke={AMBER} strokeWidth={2} strokeDasharray="6 4" />
        <path d={path(expiry)} fill="none" stroke={INK} strokeWidth={2} />
        {h && (
          <g pointerEvents="none">
            <line x1={xp(h.s)} x2={xp(h.s)} y1={T} y2={H - B} stroke={INK} opacity={0.3} />
            <g transform={`translate(${Math.min(Math.max(xp(h.s) - 80, L), W - R - 160)},${T})`}>
              <rect width="160" height="58" rx="3" fill={INK} />
              <text x="10" y="17" fill="#f7f9f3" fontSize="11">Stock at {usd(h.s)}</text>
              <text x="10" y="34" fill="#f7f9f3" fontSize="11" fontFamily="var(--mono)">At expiration {usd(h.e)}</text>
              <text x="10" y="50" fill="#f7f9f3" fontSize="11" fontFamily="var(--mono)">Today {usd(h.t)}</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Both prices across a range of volatilities. */
function VolChart({ ctx }: { ctx: OptCtx }) {
  const { m, run } = ctx;
  const [ref, W] = useWidth<HTMLDivElement>();
  const vmax = Math.max(1, m.sigma * 1.6, (run.impliedVol ?? 0) * 1.3);
  const vs = Array.from({ length: 80 }, (_, i) => 0.02 + ((vmax - 0.02) * i) / 79);
  const calls = vs.map((v) => blackScholes({ ...run.inputs, sigma: v }).call);
  const puts = vs.map((v) => blackScholes({ ...run.inputs, sigma: v }).put);
  const yt = niceTicks(0, Math.max(...calls, ...puts));
  const H = 260, L = 56, R = 16, T = 16, B = 32;
  const ytop = yt[yt.length - 1] || 1;
  const xp = (v: number) => L + ((W - L - R) * (v - 0.02)) / (vmax - 0.02);
  const yp = (v: number) => T + (H - T - B) * (1 - v / ytop);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${xp(vs[i]).toFixed(1)},${yp(v).toFixed(1)}`).join("");
  const xt = niceTicks(0, vmax, 5).filter((v) => v >= 0.02);
  return (
    <div className="chart-box" ref={ref}>
      <h3>Price vs. volatility</h3>
      <p>More expected movement makes both options worth more. Your volatility is the dashed line.</p>
      <div className="legend">
        <span><i style={{ background: CALL_C }} />Call</span>
        <span><i style={{ background: PUT_C }} />Put</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Call and put prices across volatilities">
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yp(v)} y2={yp(v)} stroke={GRID} />
            <text x={L - 8} y={yp(v) + 4} textAnchor="end" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{tick(v)}</text>
          </g>
        ))}
        {xt.map((v) => <text key={v} x={xp(v)} y={H - 10} textAnchor="middle" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{pct(v, 0)}</text>)}
        <path d={path(calls)} fill="none" stroke={CALL_C} strokeWidth={2} />
        <path d={path(puts)} fill="none" stroke={PUT_C} strokeWidth={2} />
        <line x1={xp(m.sigma)} x2={xp(m.sigma)} y1={T} y2={H - B} stroke={INK} strokeDasharray="5 4" />
        <text x={xp(m.sigma) + 4} y={T + 10} fontSize="11" fontWeight={700} fill={INK}>Yours {pct(m.sigma, 0)}</text>
        {run.impliedVol !== null && (
          <g>
            <line x1={xp(run.impliedVol)} x2={xp(run.impliedVol)} y1={T + 16} y2={H - B} stroke={RED} strokeDasharray="2 3" />
            <text x={xp(run.impliedVol) + 4} y={T + 26} fontSize="11" fontWeight={700} fill={RED}>Implied {pct(run.impliedVol, 0)}</text>
          </g>
        )}
        <circle cx={xp(m.sigma)} cy={yp(run.result.call)} r={4.5} fill={CALL_C} stroke="#f7f9f3" strokeWidth={2} />
        <circle cx={xp(m.sigma)} cy={yp(run.result.put)} r={4.5} fill={PUT_C} stroke="#f7f9f3" strokeWidth={2} />
      </svg>
    </div>
  );
}

function greekLines(g: Greeks, type: "call" | "put") {
  const name = type === "call" ? "call" : "put";
  return {
    delta: `If the stock rises $1, the ${name} ${g.delta >= 0 ? "gains" : "loses"} about ${usd(Math.abs(g.delta))}.`,
    gamma: `Each $1 move in the stock changes delta by about ${g.gamma.toFixed(3)}.`,
    vega: `If volatility rises 1 point, the ${name} gains about ${usd(g.vega)}.`,
    theta: `Each day that passes, the ${name} ${g.theta <= 0 ? "loses" : "gains"} about ${usd(Math.abs(g.theta))}, all else equal.`,
    rho: `If interest rates rise 1 point, the ${name} ${g.rho >= 0 ? "gains" : "loses"} about ${usd(Math.abs(g.rho))}.`,
  };
}

export function OptResultsStage({ ctx }: { ctx: OptCtx }) {
  const { m, run, checks, stars } = ctx;
  const R = run.result;

  const grid = useMemo(() => {
    const dv = [-0.1, -0.05, 0, 0.05, 0.1];
    const ds = [-0.1, -0.05, 0, 0.05, 0.1];
    return dv.map((v) => ds.map((s) => priceOf({ ...run.inputs, sigma: Math.max(0.01, m.sigma + v), S: m.S * (1 + s) }, m.type)));
  }, [run.inputs, m.sigma, m.S, m.type]);

  if (!run.valid) {
    return (
      <div className="bench full">
        <div className="empty">
          <h2>Nothing to price yet</h2>
          <p>Set a strike above zero, a volatility above zero and an expiration after today.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => ctx.go("contract")}>Go to the contract</button>
        </div>
      </div>
    );
  }

  const order = { bad: 0, warn: 1, good: 2 } as const;
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level]);
  const card = (t: "call" | "put") => {
    const p = t === "call" ? R.call : R.put;
    const intr = run.intrinsic[t];
    return (
      <div className={`opt-card ${m.type === t ? "is-sel" : ""} opt-${t}`}>
        <div className="opt-card-top">
          <span className={`case-tag ${t === "call" ? "case-bull" : "case-put"}`}>{t === "call" ? "Call" : "Put"}</span>
          {m.type !== t && <button className="linkbtn" onClick={() => ctx.set({ type: t })}>Focus on the {t}</button>}
        </div>
        <div className="opt-price">{price(p)}</div>
        <div className="muted" style={{ fontSize: "var(--step--1)" }}>per share, or {price(p * 100)} per contract</div>
        <dl className="case-facts">
          <dt>Intrinsic value</dt><dd className="num">{price(intr)}</dd>
          <dt>Time value</dt><dd className="num">{price(p - intr)}</dd>
          <dt>Breakeven at expiration</dt><dd className="num">{price(run.breakeven[t])}</dd>
          <dt>Chance it finishes in the money</dt><dd className="num">{pct(run.probITM[t], 0)}</dd>
          {m.marketPrice && m.type === t && (
            <>
              <dt>Market price you entered</dt>
              <dd className="num">{price(m.marketPrice)}</dd>
            </>
          )}
        </dl>
      </div>
    );
  };

  const lines = { call: greekLines(R.callGreeks, "call"), put: greekLines(R.putGreeks, "put") };
  const sel = m.type;
  const GREEKS: { k: keyof Greeks; name: string; what: string }[] = [
    { k: "delta", name: "Delta", what: "Sensitivity to the stock price" },
    { k: "gamma", name: "Gamma", what: "How fast delta changes" },
    { k: "vega", name: "Vega", what: "Sensitivity to volatility, per point" },
    { k: "theta", name: "Theta", what: "Time decay, per day" },
    { k: "rho", name: "Rho", what: "Sensitivity to rates, per point" },
  ];

  return (
    <div className="bench full">
      <section>
        <div className="opt-cards">
          {card("call")}
          {card("put")}
        </div>
        <p className="parity">
          <b>Put-call parity:</b> call − put = {price(R.call)} − {price(R.put)} = {price(R.call - R.put)}, which equals the stock minus the
          strike in today&rsquo;s dollars ({price(R.discountedS)} − {price(R.discountedK)}).
        </p>

        <div className="stars-line" style={{ marginTop: 14 }}>
          <Stars value={stars} size={22} />
          <span style={{ fontWeight: 700 }}>{stars.toFixed(1)} out of 5</span>
          <span className="muted" style={{ fontSize: "var(--step--1)" }}>
            Input quality: {checks.filter((c) => c.level === "good").length} of {checks.length} checks green
          </span>
        </div>

        {run.impliedVol !== null && m.marketPrice && (
          <div className="quant" style={{ marginTop: 22 }}>
            <div className="quant-main">
              <div className="cap">Implied volatility</div>
              <div className="quant-big">{pct(run.impliedVol, 1)}</div>
              <p className="formula-mini">The volatility that makes the model price equal your {price(m.marketPrice)} market price.</p>
            </div>
            <div className="quant-grid">
              <div className="stat">
                <div className="stat-label">Historical volatility</div>
                <div className="stat-value">{m.histVol ? pct(m.histVol, 1) : "n/a"}</div>
                <p>How much the stock actually moved over the past year.</p>
              </div>
              <div className="stat">
                <div className="stat-label">What the market expects</div>
                <div className="stat-value">{m.histVol ? `${(run.impliedVol / m.histVol).toFixed(2)}x` : "n/a"}</div>
                <p>
                  {m.histVol
                    ? run.impliedVol > m.histVol * 1.15
                      ? "Bigger moves than the past year. Often an earnings report or event falls before expiration."
                      : run.impliedVol < m.histVol * 0.85
                        ? "Calmer trading than the past year."
                        : "About the same movement as the past year."
                    : "Load price history to compare."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="charts" style={{ marginTop: 28 }}>
          <PayoffChart ctx={ctx} />
          <VolChart ctx={ctx} />
        </div>

        <h2 className="section-h">The Greeks</h2>
        <p className="section-p">How the option&rsquo;s price responds when one input changes and everything else holds still. The sentence is for the {sel}.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="greeks">
            <thead>
              <tr><th>Greek</th><th>Measures</th><th className="num">Call</th><th className="num">Put</th><th>In plain English ({sel})</th></tr>
            </thead>
            <tbody>
              {GREEKS.map((g) => (
                <tr key={g.k}>
                  <td><b>{g.name}</b></td>
                  <td className="muted">{g.what}</td>
                  <td className={`num ${sel === "call" ? "is-sel" : ""}`}>{R.callGreeks[g.k].toFixed(g.k === "gamma" ? 4 : 3)}</td>
                  <td className={`num ${sel === "put" ? "is-sel" : ""}`}>{R.putGreeks[g.k].toFixed(g.k === "gamma" ? 4 : 3)}</td>
                  <td>{lines[sel][g.k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="section-h">Sensitivity</h2>
        <p className="section-p">The {sel}&rsquo;s value if the stock price and volatility were different today. The outlined cell is your contract.</p>
        <div className="sens-wrap">
          <table className="sens">
            <caption>Volatility (rows) and share price (columns)</caption>
            <thead>
              <tr>
                <th />
                {[-0.1, -0.05, 0, 0.05, 0.1].map((d) => <th key={d}>{price(m.S * (1 + d))}</th>)}
              </tr>
            </thead>
            <tbody>
              {[-0.1, -0.05, 0, 0.05, 0.1].map((dv, i) => (
                <tr key={dv}>
                  <th>{pct(Math.max(0.01, m.sigma + dv), 0)}</th>
                  {grid[i].map((p, j) => (
                    <td key={j} className={i === 2 && j === 2 ? "center" : ""}
                      style={{ background: `color-mix(in oklab, #f7f9f3 ${Math.round(100 - Math.min(1, p / (Math.max(...grid.flat()) || 1)) * 60)}%, ${sel === "call" ? "#9cc3a6" : "#9fb6d8"})` }}>
                      {price(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="section-h">Sanity checks</h2>
        <p className="section-p">Each check compares an input to what&rsquo;s normal. Yellow costs half a star, red a full star.</p>
        <div className="checklist">
          {sorted.map((c) => (
            <div key={c.id} className="checkrow">
              <Dot level={c.level} />
              <span className="t">{c.title}</span>
              <span className="m">{c.message}</span>
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: "var(--step--1)", marginTop: 16 }}>
          Prices as of {fmtDate(m.priceDate)}. Black-Scholes assumes constant volatility and rates, no transaction costs and exercise only at
          expiration. Real option prices also reflect supply and demand.
        </p>

        <div className="step-nav">
          <button className="btn ghost" onClick={() => ctx.go("model")}>Back to the formula</button>
          <button className="btn ghost" onClick={() => ctx.go("contract")}>Change the contract</button>
        </div>
      </section>
    </div>
  );
}
