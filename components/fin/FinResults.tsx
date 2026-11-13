"use client";

import { useMemo } from "react";
import type { FinCtx } from "./FinTool";
import { Dot, Stars } from "../ui";
import { useWidth } from "../useWidth";
import { equitySensitivity, impliedLongRunRoe } from "@/lib/equity";
import { moneyB, pct, price, signedPct } from "@/lib/format";

const INK = "#18201c";
const GREEN = "#2f5d46";
const RED = "#b0281f";
const GRID = "#cfd9c8";
const MUTED = "#7a857e";
const BLUE = "#2b5aa0";

/** Return on equity each year against the cost of equity: the gap is what creates value. */
function RoeChart({ ctx }: { ctx: FinCtx }) {
  const { m, r } = ctx;
  const [ref, W] = useWidth<HTMLDivElement>();
  const hist = m.history.map((h, i) => {
    const prev = i > 0 ? m.history[i - 1].bookEquity : h.bookEquity;
    const avg = (prev + h.bookEquity) / 2;
    return { label: h.label, v: avg > 0 ? h.netIncome / avg : 0, f: false };
  });
  const pts = [...hist, ...r.years.map((y) => ({ label: y.label, v: y.roe, f: true })), { label: "Long run", v: m.longRunRoe, f: true }];
  const ke = r.costOfEquity;
  const vals = [...pts.map((p) => p.v), ke];
  const lo = Math.min(0, ...vals) - 0.01, hi = Math.max(...vals) + 0.02;
  const H = 230, L = 48, R = 14, T = 16, B = 30;
  const x = (i: number) => L + ((W - L - R) * (i + 0.5)) / pts.length;
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const bw = Math.min(34, ((W - L - R) / pts.length) * 0.6);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo * 20) / 20; t <= hi; t += 0.05) ticks.push(Number(t.toFixed(2)));
  return (
    <div className="chart-box" ref={ref}>
      <h3>Return on equity vs. cost of equity</h3>
      <p>Bars above the line earn more than shareholders require and add value above book. Lighter bars are your forecast.</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Return on equity by year against the cost of equity">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK : GRID} />
            <text x={L - 7} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED} fontFamily="var(--mono)">{pct(t, 0)}</text>
          </g>
        ))}
        {pts.map((p, i) => (
          <g key={p.label}>
            <rect x={x(i) - bw / 2} y={Math.min(y(p.v), y(0))} width={bw} height={Math.abs(y(p.v) - y(0))} rx={3}
              fill={p.v >= ke ? GREEN : RED} opacity={p.f ? 0.55 : 1} />
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill={MUTED}>{p.label.replace("FY", "")}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(ke)} y2={y(ke)} stroke={BLUE} strokeWidth={2} strokeDasharray="6 4" />
        <text x={L + 6} y={y(ke) - 6} fontSize="11" fontWeight={700} fill={BLUE} stroke="#f7f9f3" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
          Cost of equity {pct(ke, 1)}
        </text>
      </svg>
    </div>
  );
}

/** Where the value comes from: book equity, then excess returns. */
function Bridge({ ctx }: { ctx: FinCtx }) {
  const { m, r } = ctx;
  const sh = m.sharesOutstanding;
  const parts = [
    { k: "Book value", v: m.bookEquity / sh, c: INK },
    { k: "Excess returns, years 1 to 5", v: r.sumPv / sh, c: r.sumPv >= 0 ? GREEN : RED },
    { k: "After year 5", v: (r.terminal.valid ? r.terminal.pv : 0) / sh, c: r.terminal.pv >= 0 ? GREEN : RED },
  ];
  const total = r.valuePerShare;
  const max = Math.max(total, m.bookEquity / sh, m.sharePrice) * 1.08;
  let run = 0;
  return (
    <div className="chart-box">
      <h3>Where the value comes from</h3>
      <p>Per share. Book value is what shareholders have put in; the rest is the value of earning more, or less, than they require.</p>
      <div className="bridge">
        {parts.map((p) => {
          const from = run;
          run += p.v;
          const a = Math.min(from, run), b = Math.max(from, run);
          return (
            <div className="bridge-row" key={p.k}>
              <span className="bridge-k">{p.k}</span>
              <span className="bridge-track">
                <span className="bridge-bar" style={{ left: `${(Math.max(a, 0) / max) * 100}%`, width: `${(Math.max(b - Math.max(a, 0), 0) / max) * 100}%`, background: p.c }} />
              </span>
              <span className="bridge-v num">{p.v >= 0 && p.k !== "Book value" ? "+" : ""}{price(p.v)}</span>
            </div>
          );
        })}
        <div className="bridge-row total">
          <span className="bridge-k">Value per share</span>
          <span className="bridge-track">
            <span className="bridge-bar" style={{ left: 0, width: `${(Math.max(total, 0) / max) * 100}%`, background: INK }} />
            {m.sharePrice > 0 && <span className="bridge-price" style={{ left: `${(m.sharePrice / max) * 100}%` }} title={`Market price ${price(m.sharePrice)}`} />}
          </span>
          <span className="bridge-v num">{price(total)}</span>
        </div>
        {m.sharePrice > 0 && <p className="faint" style={{ fontSize: "var(--step--1)", marginTop: 6 }}>The dashed line is today&rsquo;s price, {price(m.sharePrice)}.</p>}
      </div>
    </div>
  );
}

export function FinResults({ ctx }: { ctx: FinCtx }) {
  const { m, r, checks, stars, set } = ctx;
  const implied = useMemo(() => impliedLongRunRoe(m), [m]);
  const dR = [-0.02, -0.01, 0, 0.01, 0.02];
  const dK = [-0.01, -0.005, 0, 0.005, 0.01];
  const grid = useMemo(() => equitySensitivity(m, dR, dK), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = { bad: 0, warn: 1, good: 2 } as const;
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level]);
  const below = r.upside < 0;

  if (!Number.isFinite(r.valuePerShare)) {
    return (
      <div className="bench full">
        <div className="empty">
          <h2>Nothing to value yet</h2>
          <p>Check shares outstanding, book equity and that terminal growth is below the cost of equity.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => ctx.go("inputs")}>Go to inputs</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bench full">
      <section>
        <div className="verdict">
          <div>
            <div className="cap">Value per share</div>
            <div className={`big ${r.valuePerShare < 0 ? "neg" : ""}`}>{price(r.valuePerShare)}</div>
          </div>
          <div>
            <div className="cap">Market price</div>
            <div className="delta">{m.sharePrice > 0 ? price(m.sharePrice) : "n/a"}</div>
            {m.sharePrice > 0 && <div className={`num ${below ? "neg" : ""}`} style={{ fontWeight: 600, marginTop: 4 }}>{signedPct(r.upside)}</div>}
          </div>
          <p className="say">
            At your assumptions, {m.company.name} is worth {r.impliedPriceToBook.toFixed(2)}x its book value of {price(r.bookPerShare)} a share.
            {m.sharePrice > 0 && ` The market prices it at ${r.marketPriceToBook.toFixed(2)}x.`}
          </p>
        </div>

        <div className="stars-line" style={{ marginTop: 18 }}>
          <Stars value={stars} size={22} />
          <span style={{ fontWeight: 700 }}>{stars.toFixed(1)} out of 5</span>
          <span className="muted" style={{ fontSize: "var(--step--1)" }}>Model quality: {checks.filter((c) => c.level === "good").length} of {checks.length} checks green</span>
        </div>

        <div className="charts" style={{ marginTop: 28 }}>
          <Bridge ctx={ctx} />
          <RoeChart ctx={ctx} />
        </div>

        {m.sharePrice > 0 && (
          <>
            <h2 className="section-h">What the market is pricing in</h2>
            <p className="section-p">Holding everything else constant, the long-run ROE that would make the model land exactly on {price(m.sharePrice)}.</p>
            <div className="reverse">
              <div>
                <div className="rv-cap">Long-run ROE needed</div>
                <div className="rv">{implied !== null ? pct(implied, 1) : "n/a"}</div>
                <p>
                  You used {pct(m.longRunRoe)}, against a {pct(r.costOfEquity, 1)} cost of equity.{" "}
                  {implied !== null && (implied > m.longRunRoe
                    ? "The market expects the company to keep earning higher returns than your forecast."
                    : "The market expects lower long-run returns than you do.")}
                </p>
                {implied !== null && Math.abs(implied - m.longRunRoe) > 0.0005 && (
                  <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => set({ longRunRoe: Math.round(implied * 10000) / 10000 }, ["longRunRoe"])}>
                    Use {pct(implied, 1)}
                  </button>
                )}
              </div>
              <div>
                <div className="rv-cap">Price to book</div>
                <div className="rv">{Number.isFinite(r.marketPriceToBook) ? `${r.marketPriceToBook.toFixed(2)}x` : "n/a"}</div>
                <p>
                  A bank trades above book value only if investors expect it to earn more than its cost of equity. Market value is{" "}
                  {moneyB(m.sharePrice * m.sharesOutstanding)} against book equity of {moneyB(m.bookEquity)}.
                </p>
              </div>
            </div>
          </>
        )}

        <h2 className="section-h">Sensitivity</h2>
        <p className="section-p">Value per share if the long-run ROE (rows) and the cost of equity (columns) were different. The outlined cell is your model.</p>
        <div className="sens-wrap">
          <table className="sens">
            <caption>Long-run ROE (rows) and cost of equity (columns)</caption>
            <thead>
              <tr>
                <th />
                {dK.map((d) => <th key={d}>{pct(r.costOfEquity + d, 1)}</th>)}
              </tr>
            </thead>
            <tbody>
              {dR.map((dr, i) => (
                <tr key={dr}>
                  <th>{pct(m.longRunRoe + dr, 1)}</th>
                  {grid[i].map((v, j) => (
                    <td key={j} className={i === 2 && j === 2 ? "center" : ""}
                      style={{ background: Number.isFinite(v) && m.sharePrice > 0 ? (v >= m.sharePrice * 1.05 ? "#d6e4d6" : v <= m.sharePrice * 0.95 ? "#f1d9d3" : "#e4e6e1") : undefined }}>
                      {Number.isFinite(v) ? price(v) : "n/a"}
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

        <div className="step-nav">
          <button className="btn ghost" onClick={() => ctx.go("model")}>Back to the model</button>
          <button className="btn ghost" onClick={() => ctx.go("inputs")}>Change assumptions</button>
        </div>
      </section>
    </div>
  );
}
