"use client";

import type { FinCtx } from "./FinTool";
import { Dot, Field, NumInput, SourceNote, Stars } from "../ui";
import { worstLevelFor } from "@/lib/checks";
import { costOfEquity, forecastLabels, type EquityYear } from "@/lib/equity";
import { moneyB, pct, price, signedPct } from "@/lib/format";

const Src = ({ text }: { text?: string }) =>
  text ? <p className="faint" style={{ fontSize: "var(--step--1)", marginTop: 8, maxWidth: "80ch" }}>{text}</p> : null;

export function FinLive({ ctx }: { ctx: FinCtx }) {
  const { m, r, checks, stars } = ctx;
  const issues = checks.filter((c) => c.level !== "good").sort((a, b) => (a.level === "bad" ? -1 : b.level === "bad" ? 1 : 0));
  const ok = Number.isFinite(r.valuePerShare);
  return (
    <aside className="live" aria-label="Live valuation">
      <div className="live-head">
        <div className="live-title">Value per share</div>
        <div className={`live-price ${ok && r.valuePerShare < 0 ? "neg" : ""}`}>{ok ? price(r.valuePerShare) : "n/a"}</div>
        {m.sharePrice > 0 && ok && <div className="live-vs">{signedPct(r.upside)} vs. market price of {price(m.sharePrice)}</div>}
      </div>
      <div className="live-sec">
        <div className="stars-line">
          <Stars value={stars} />
          <span className="stars-score">{stars.toFixed(1)} / 5</span>
        </div>
        <div className="live-title" style={{ marginTop: 4 }}>Model quality, from {checks.length} sanity checks</div>
        {issues.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--step--1)", marginTop: 8 }}>Every check is green.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {issues.slice(0, 4).map((c) => (
              <div key={c.id} className="issue">
                <Dot level={c.level} />
                <span>{c.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="live-sec">
        <div className="live-row"><span>Cost of equity</span><span className="num">{pct(r.costOfEquity, 2)}</span></div>
        <div className="live-row"><span>Book value per share</span><span className="num">{price(r.bookPerShare)}</span></div>
        <div className="live-row"><span>Price to book, your value</span><span className="num">{Number.isFinite(r.impliedPriceToBook) ? `${r.impliedPriceToBook.toFixed(2)}x` : "n/a"}</span></div>
        <div className="live-row"><span>Price to book, market</span><span className="num">{Number.isFinite(r.marketPriceToBook) ? `${r.marketPriceToBook.toFixed(2)}x` : "n/a"}</span></div>
      </div>
    </aside>
  );
}

export function FinInputs({ ctx }: { ctx: FinCtx }) {
  const { m, r, set, checks, go } = ctx;
  const lvl = (f: string) => worstLevelFor(checks, f);
  const labels = forecastLabels(m.company.baseYearLabel);
  const ke = costOfEquity(m);
  const setHist = (i: number, key: keyof EquityYear, v: number) => {
    const history = m.history.map((h, j) => (j === i ? { ...h, [key]: v } : h));
    set({ history, ...(i === m.history.length - 1 && key === "bookEquity" ? { bookEquity: v } : {}) }, ["history"]);
  };

  return (
    <div className="bench wide">
      <section className="step">
        <h1>Value it on its equity</h1>
        <p className="lede">
          For a bank, debt is the raw material of the business, so free cash flow doesn&rsquo;t mean much. Instead, this model starts from
          book equity and adds the value of the profit the company earns above what its shareholders require.
        </p>

        <h2 className="section-h" style={{ marginTop: 32 }}>From the annual report</h2>
        <p className="section-p">$ in millions. Common equity leaves out preferred stock. Payouts are common dividends plus share buybacks.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th>Fiscal year</th>
                {m.history.map((h) => <th key={h.label} className="num">{h.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["netIncome", "Net income to common shareholders", "Income statement"],
                  ["bookEquity", "Common equity at year end", "Balance sheet"],
                  ["payouts", "Dividends plus buybacks", "Cash flow statement"],
                ] as [keyof EquityYear, string, string][]
              ).map(([key, label, where]) => (
                <tr key={key}>
                  <td className="label">
                    {label}
                    <div className="field-help">{where}</div>
                  </td>
                  {m.history.map((h, i) => (
                    <td key={h.label}>
                      <NumInput kind="money" label={`${label} ${h.label}`} value={h[key] as number} onChange={(n) => setHist(i, key, n)} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="label faint">Return on equity</td>
                {m.history.map((h, i) => {
                  const prev = i > 0 ? m.history[i - 1].bookEquity : h.bookEquity;
                  const avg = (prev + h.bookEquity) / 2;
                  return <td key={h.label} className="num faint">{avg > 0 ? pct(h.netIncome / avg) : ""}</td>;
                })}
              </tr>
              <tr>
                <td className="label faint">Payout ratio</td>
                {m.history.map((h) => <td key={h.label} className="num faint">{h.netIncome > 0 ? pct(h.payouts / h.netIncome, 0) : ""}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <Src text={m.sources.history?.note} />

        <h2 className="section-h">Returns</h2>
        <p className="section-p">
          Return on equity (ROE) is net income divided by book equity. What matters is how it compares with the {pct(ke, 1)} return
          shareholders require: above it, the company is worth more than book value; below it, less.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th />
                {labels.map((l) => <th key={l} className="num">{l}</th>)}
                <th className="num">After</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="label">
                  Return on equity
                  <div className="field-help">Fades from today toward the long-run level</div>
                </td>
                {m.roe.map((v, i) => (
                  <td key={i}>
                    <NumInput kind="pct" label={`ROE ${labels[i]}`} level={i === 0 ? lvl("roe") : null} value={v}
                      onChange={(n) => set({ roe: m.roe.map((x, j) => (j === i ? n : x)) }, ["roe"])} />
                  </td>
                ))}
                <td>
                  <NumInput kind="pct" label="Long-run ROE" level={lvl("longRunRoe")} value={m.longRunRoe} onChange={(n) => set({ longRunRoe: n }, ["longRunRoe"])} />
                </td>
              </tr>
              <tr>
                <td className="label faint">Above or below the cost of equity</td>
                {[...m.roe, m.longRunRoe].map((v, i) => (
                  <td key={i} className={`num faint ${v < ke ? "neg" : ""}`}>{signedPct(v - ke)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <Src text={m.sources.roe?.note} />

        <div className="body" style={{ marginTop: 24 }}>
          <Field
            label="Payout ratio"
            help="Share of earnings returned as dividends and buybacks. The rest stays in the company and grows book equity."
            dot={lvl("payoutRatio")}
            input={<NumInput kind="pct" label="Payout ratio" level={lvl("payoutRatio")} value={m.payoutRatio} onChange={(n) => set({ payoutRatio: n }, ["payoutRatio"])} />}
            notes={<SourceNote source={m.sources.payoutRatio} />}
          />
        </div>

        <h2 className="section-h">Cost of equity</h2>
        <p className="section-p">The return shareholders require, from the capital asset pricing model: risk-free rate + beta × equity risk premium = {pct(ke, 2)}.</p>
        <div className="body">
          <Field label="Risk-free rate" help="10-year Treasury yield." dot={lvl("riskFreeRate")}
            input={<NumInput kind="pct" label="Risk-free rate" value={m.riskFreeRate} onChange={(n) => set({ riskFreeRate: n }, ["riskFreeRate"])} />}
            notes={<SourceNote source={m.sources.riskFreeRate} />} />
          <Field label="Beta" help="How much the stock moves with the market." dot={lvl("beta")}
            input={<NumInput kind="num" label="Beta" level={lvl("beta")} value={m.beta} onChange={(n) => set({ beta: n }, ["beta"])} />}
            notes={<SourceNote source={m.sources.beta} />} />
          <Field label="Equity risk premium" help="Extra return investors want for owning stocks over Treasuries."
            input={<NumInput kind="pct" label="Equity risk premium" value={m.equityRiskPremium} onChange={(n) => set({ equityRiskPremium: n }, ["equityRiskPremium"])} />}
            notes={<SourceNote source={m.sources.equityRiskPremium} />} />
        </div>

        <h2 className="section-h">After year five</h2>
        <div className="body">
          <Field label="Terminal growth" help="How fast excess returns grow forever after the forecast." dot={lvl("terminalGrowth")}
            input={<NumInput kind="pct" label="Terminal growth" level={lvl("terminalGrowth")} value={m.terminalGrowth} onChange={(n) => set({ terminalGrowth: n }, ["terminalGrowth"])} />}
            notes={
              <>
                <SourceNote source={m.sources.terminalGrowth} />
                <span className="ref">Growth the company can fund itself: {pct(m.longRunRoe)} × (1 − {pct(m.payoutRatio, 0)}) = {pct(r.sustainableGrowth)}.</span>
              </>
            }
          />
        </div>

        <h2 className="section-h">Shares</h2>
        <div className="body">
          <Field label="Share price" help={m.company.priceDate ? `Last close` : "Enter today's price."}
            input={<NumInput kind="price" label="Share price" value={m.sharePrice} onChange={(n) => set({ sharePrice: n }, ["sharePrice"])} />}
            notes={<SourceNote source={m.sources.sharePrice} />} />
          <Field label="Shares outstanding" help="In millions."
            input={<NumInput kind="shares" label="Shares outstanding" value={m.sharesOutstanding} onChange={(n) => set({ sharesOutstanding: n }, ["sharesOutstanding"])} />}
            notes={
              <>
                <SourceNote source={m.sources.sharesOutstanding} />
                <span className="ref">Book equity today: {moneyB(m.bookEquity)}, or {price(r.bookPerShare)} a share.</span>
              </>
            }
          />
        </div>

        <div className="step-nav">
          <span />
          <button className="btn" onClick={() => go("model")}>See the model</button>
        </div>
      </section>
      <FinLive ctx={ctx} />
    </div>
  );
}
