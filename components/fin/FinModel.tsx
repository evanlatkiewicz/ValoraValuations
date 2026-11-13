"use client";

import type { FinCtx } from "./FinTool";
import { FinLive } from "./FinInputs";
import { money, pct, price } from "@/lib/format";

export function FinModel({ ctx }: { ctx: FinCtx }) {
  const { m, r, go } = ctx;
  const ke = r.costOfEquity;
  const rows: { label: string; sub?: boolean; total?: boolean; cells: string[]; neg?: boolean[] }[] = [
    { label: "Book equity, start of year", cells: r.years.map((y) => money(y.startBook)) },
    { label: "Return on equity", sub: true, cells: r.years.map((y) => pct(y.roe)) },
    { label: "Net income", cells: r.years.map((y) => money(y.netIncome)) },
    { label: "Dividends and buybacks", sub: true, cells: r.years.map((y) => money(-y.payouts)) },
    { label: "Book equity, end of year", total: true, cells: r.years.map((y) => money(y.endBook)) },
    { label: `Equity charge (${pct(ke, 2)} × starting book)`, cells: r.years.map((y) => money(-y.equityCharge)) },
    { label: "Excess return", total: true, cells: r.years.map((y) => money(y.excessReturn)), neg: r.years.map((y) => y.excessReturn < 0) },
    { label: "Discount factor", sub: true, cells: r.years.map((y) => y.discountFactor.toFixed(4)) },
    { label: "Present value", total: true, cells: r.years.map((y) => money(y.pv)), neg: r.years.map((y) => y.pv < 0) },
  ];
  const last = r.years.at(-1)!;

  return (
    <div className="bench wide">
      <section>
        <div className="step">
          <h1>The excess return model</h1>
          <p className="lede">
            Each year, net income is compared with the profit shareholders require on the equity they&rsquo;ve put in. Only the
            difference, the excess return, adds value above book. $ in millions.
          </p>
        </div>
        <div className="sheet-wrap" style={{ marginTop: 24 }}>
          <table className="sheet" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Line</th>
                {r.years.map((y) => <th key={y.label}>{y.label}<span className="kind">Forecast</span></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={row.sub ? "sub" : row.total ? "total" : undefined}>
                  <td>{row.label}</td>
                  {row.cells.map((c, i) => <td key={i} className={`num ${row.neg?.[i] ? "neg" : ""}`} style={{ fontFamily: "var(--mono)" }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="section-h">From excess returns to a value per share</h2>
        <div className="ledger" style={{ maxWidth: 680, marginTop: 14 }}>
          <div className="ledger-row"><span>Book equity today</span><span className="num">{money(m.bookEquity)}</span></div>
          <div className="ledger-row"><span>+ Present value of excess returns, years 1 to 5</span><span className="num">{money(r.sumPv)}</span></div>
          <div className="ledger-row">
            <span>
              + Present value of the terminal value
              <div className="formula">
                ({pct(m.longRunRoe)} − {pct(ke, 2)}) × {money(last.endBook)} / ({pct(ke, 2)} − {pct(m.terminalGrowth)}) ={" "}
                {r.terminal.valid ? money(r.terminal.value) : "n/a"}, × {last.discountFactor.toFixed(4)}
              </div>
            </span>
            <span className="num">{r.terminal.valid ? money(r.terminal.pv) : "n/a"}</span>
          </div>
          <div className="ledger-row total"><span>= Equity value</span><span className="num">{money(r.equityValue)}</span></div>
          <div className="ledger-row"><span>/ Shares outstanding (millions)</span><span className="num">{m.sharesOutstanding.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span></div>
          <div className="ledger-row total"><span>= Value per share</span><span className="num">{price(r.valuePerShare)}</span></div>
        </div>
        <p className="faint" style={{ fontSize: "var(--step--1)", marginTop: 10, maxWidth: "80ch" }}>
          If the company earned exactly its cost of equity every year, the excess returns would be zero and it would be worth exactly book
          value. That&rsquo;s why price-to-book is the main multiple for banks.
        </p>

        <div className="step-nav">
          <button className="btn ghost" onClick={() => go("inputs")}>Back to inputs</button>
          <button className="btn" onClick={() => go("results")}>See the valuation</button>
        </div>
      </section>
      <FinLive ctx={ctx} />
    </div>
  );
}
