"use client";

import { useState } from "react";
import type { Ctx } from "./Valora";
import { LiveRead } from "./LiveRead";
import { isNeg, money, mult, pct, price } from "@/lib/format";
import type { ProjectedYear } from "@/lib/types";

type Fmt = "money" | "pct" | "factor" | "period";

interface Row {
  key: string;
  label: string;
  style?: "sub" | "total";
  fmt: Fmt;
  hist?: (i: number) => number;
  proj: (y: ProjectedYear, i: number) => number;
  explain: (i: number) => { words: string; math: string };
  onlyLast?: boolean;
}

function fmt(v: number, f: Fmt): string {
  if (!isFinite(v)) return "";
  if (f === "pct") return pct(v);
  if (f === "factor") return v.toFixed(4);
  if (f === "period") return v.toFixed(1);
  return money(v);
}

export function ModelStage({ ctx }: { ctx: Ctx }) {
  const [sel, setSel] = useState<{ row: string; col: number } | null>({ row: "ufcf", col: 0 });
  const { inputs: inp, result: r, ready } = ctx;

  if (!ready) {
    return (
      <div className="bench wide">
        <div className="empty">
          <h2>The model needs a few more inputs</h2>
          <p>Add {ctx.missing.join(", ").toLowerCase()} and the model will compile here.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => ctx.go("inputs", 0)}>Go to inputs</button>
        </div>
        <LiveRead ctx={ctx} />
      </div>
    );
  }

  const h = inp.history;
  const ys = r.years;
  const prevRev = (i: number) => (i === 0 ? h[h.length - 1].revenue : ys[i - 1].revenue);
  const prevNwc = (i: number) => (i === 0 ? inp.baseNwc : ys[i - 1].nwc);
  const w = r.wacc.wacc;

  const rows: (Row | "gap")[] = [
    {
      key: "revenue", label: "Revenue", fmt: "money",
      hist: (i) => h[i].revenue, proj: (y) => y.revenue,
      explain: (i) => ({ words: "Last year's revenue, grown by this year's growth rate.", math: `${money(prevRev(i))} × (1 + ${pct(ys[i].growth)}) = ${money(ys[i].revenue)}` }),
    },
    {
      key: "growth", label: "Growth", style: "sub", fmt: "pct",
      hist: (i) => (i > 0 ? h[i].revenue / h[i - 1].revenue - 1 : NaN), proj: (y) => y.growth,
      explain: () => ({ words: "Your assumption from the Revenue step.", math: "Input" }),
    },
    {
      key: "ebit", label: "Operating income (EBIT)", fmt: "money",
      hist: (i) => h[i].ebit, proj: (y) => y.ebit,
      explain: (i) => ({ words: "Revenue times operating margin.", math: `${money(ys[i].revenue)} × ${pct(ys[i].margin)} = ${money(ys[i].ebit)}` }),
    },
    {
      key: "margin", label: "Operating margin", style: "sub", fmt: "pct",
      hist: (i) => h[i].ebit / h[i].revenue, proj: (y) => y.margin,
      explain: () => ({ words: "Your assumption from the Operating margin step.", math: "Input" }),
    },
    {
      key: "taxes", label: "Less: taxes", fmt: "money", proj: (y) => -y.taxes,
      explain: (i) => ({ words: "Taxes on operating income. We tax EBIT, not net income, because the DCF values the whole business before paying lenders.", math: `${money(ys[i].ebit)} × ${pct(inp.taxRate)} = ${money(ys[i].taxes)}` }),
    },
    {
      key: "nopat", label: "NOPAT", style: "total", fmt: "money", proj: (y) => y.nopat,
      explain: (i) => ({ words: "Net operating profit after tax: what the business earns if it had no debt.", math: `${money(ys[i].ebit)} − ${money(ys[i].taxes)} = ${money(ys[i].nopat)}` }),
    },
    {
      key: "da", label: "Plus: D&A", fmt: "money",
      hist: (i) => h[i].da, proj: (y) => y.da,
      explain: (i) => ({ words: "Depreciation and amortization reduce profit but don't use cash, so they're added back.", math: `${money(ys[i].revenue)} × ${pct(inp.daPct)} = ${money(ys[i].da)}` }),
    },
    {
      key: "capex", label: "Less: capex", fmt: "money",
      hist: (i) => -h[i].capex, proj: (y) => -y.capex,
      explain: (i) => ({ words: "Cash spent on property and equipment.", math: `${money(ys[i].revenue)} × ${pct(inp.capexPct)} = ${money(ys[i].capex)}` }),
    },
    {
      key: "nwc", label: "Less: increase in working capital", fmt: "money", proj: (y) => -y.changeInNwc,
      explain: (i) => ({
        words: "Working capital is a percent of revenue. When it grows, cash is tied up. When it shrinks (or is negative and the company grows), cash comes in.",
        math: `NWC = ${money(ys[i].revenue)} × ${pct(inp.nwcPct)} = ${money(ys[i].nwc)}\nChange = ${money(ys[i].nwc)} − ${money(prevNwc(i))} = ${money(ys[i].changeInNwc)}`,
      }),
    },
    {
      key: "ufcf", label: "Unlevered free cash flow", style: "total", fmt: "money", proj: (y) => y.ufcf,
      explain: (i) => ({
        words: "Cash the business generates for all investors, debt and equity, after reinvesting.",
        math: `${money(ys[i].nopat)} + ${money(ys[i].da)} − ${money(ys[i].capex)} − ${money(ys[i].changeInNwc)} = ${money(ys[i].ufcf)}`,
      }),
    },
    "gap",
    {
      key: "period", label: "Discount period", style: "sub", fmt: "period", proj: (y) => y.period,
      explain: (i) => ({ words: inp.midYear ? "Years from today, using the mid-year convention." : "Years from today. Cash is assumed to arrive at the end of each year.", math: `${ys[i].period.toFixed(1)}` }),
    },
    {
      key: "df", label: "Discount factor", style: "sub", fmt: "factor", proj: (y) => y.discountFactor,
      explain: (i) => ({ words: "What a dollar received in that year is worth today at your WACC.", math: `1 ÷ (1 + ${pct(w, 2)})^${ys[i].period.toFixed(1)} = ${ys[i].discountFactor.toFixed(4)}` }),
    },
    {
      key: "pv", label: "Present value of FCF", style: "total", fmt: "money", proj: (y) => y.pvUfcf,
      explain: (i) => ({ words: "Free cash flow converted to today's dollars.", math: `${money(ys[i].ufcf)} × ${ys[i].discountFactor.toFixed(4)} = ${money(ys[i].pvUfcf)}` }),
    },
    "gap",
    {
      key: "tv", label: "Terminal value", fmt: "money", onlyLast: true, proj: () => r.terminal.value,
      explain: () =>
        inp.terminalMethod === "gordon"
          ? { words: "Value of every year after year 5, assuming cash flow grows at your terminal rate forever.", math: `${money(ys[4].ufcf)} × (1 + ${pct(inp.terminalGrowth)}) ÷ (${pct(w, 2)} − ${pct(inp.terminalGrowth)}) = ${money(r.terminal.value)}` }
          : { words: "Value of the business at the end of year 5, priced at your exit multiple of EBITDA.", math: `${money(ys[4].ebitda)} × ${mult(inp.exitMultiple)} = ${money(r.terminal.value)}` },
    },
    {
      key: "pvtv", label: "Present value of terminal value", style: "total", fmt: "money", onlyLast: true, proj: () => r.terminal.pv,
      explain: () => ({ words: "The terminal value sits at the end of year 5, so it is discounted five full years.", math: `${money(r.terminal.value)} × ${r.terminal.discountFactor.toFixed(4)} = ${money(r.terminal.pv)}` }),
    },
  ];

  const selRow = rows.find((x) => x !== "gap" && x.key === sel?.row) as Row | undefined;
  const ex = selRow && sel ? selRow.explain(sel.col) : null;

  return (
    <div className="bench wide">
      <section>
        <div className="step">
          <h1>The compiled model</h1>
          <p className="lede">
            Every number below comes from your inputs. Shaded columns are actual results. Click any projected number to see how it was calculated.
            Figures are in millions of dollars, and red numbers in parentheses are negative.
          </p>
        </div>

        <div className="sheet-wrap" style={{ marginTop: 24 }}>
          <table className="sheet">
            <thead>
              <tr>
                <th>{inp.company.name || "Company"}</th>
                {h.map((y) => <th key={y.label} className="actual">{y.label}<span className="kind">actual</span></th>)}
                {ys.map((y) => <th key={y.label}>{y.label}<span className="kind">projected</span></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) =>
                row === "gap" ? (
                  <tr key={`g${ri}`} className="gap"><td colSpan={1 + h.length + ys.length} /></tr>
                ) : (
                  <tr key={row.key} className={row.style}>
                    <td>{row.label}</td>
                    {h.map((_, i) => {
                      const v = row.hist ? row.hist(i) : NaN;
                      return <td key={i} className={`actual num ${isNeg(v) ? "neg" : ""}`}>{fmt(v, row.fmt)}</td>;
                    })}
                    {ys.map((y, i) => {
                      if (row.onlyLast && i < 4) return <td key={i} />;
                      const v = row.proj(y, i);
                      const selected = sel?.row === row.key && sel.col === i;
                      return (
                        <td
                          key={i}
                          className={`cell ${isNeg(v) ? "neg" : ""}`}
                          aria-selected={selected}
                          tabIndex={0}
                          onClick={() => setSel({ row: row.key, col: i })}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel({ row: row.key, col: i })}
                        >
                          {fmt(v, row.fmt)}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {ex && selRow && sel && (
          <div className="explain" aria-live="polite">
            <h3>{selRow.label}, {ys[sel.col].label}</h3>
            <p className="words">{ex.words}</p>
            <pre className="math" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{ex.math}</pre>
          </div>
        )}

        <div className="blocks">
          <div>
            <div className="block-title">Discount rate</div>
            <div className="ledger">
              <div className="ledger-row"><span>Cost of equity<div className="formula">{pct(inp.riskFreeRate, 2)} + {inp.beta.toFixed(2)} × {pct(inp.equityRiskPremium, 2)}</div></span><span className="num">{pct(r.wacc.costOfEquity, 2)}</span></div>
              <div className="ledger-row"><span>After-tax cost of debt</span><span className="num">{pct(r.wacc.afterTaxCostOfDebt, 2)}</span></div>
              <div className="ledger-row"><span>Weights, equity / debt</span><span className="num">{pct(r.wacc.equityWeight, 1)} / {pct(r.wacc.debtWeight, 1)}</span></div>
              <div className="ledger-row total"><span>WACC</span><span className="num">{pct(w, 2)}</span></div>
            </div>
          </div>
          <div>
            <div className="block-title">Enterprise value</div>
            <div className="ledger">
              <div className="ledger-row"><span>PV of five years of FCF</span><span className="num">{money(r.sumPvUfcf)}</span></div>
              <div className="ledger-row"><span>PV of terminal value</span><span className="num">{money(r.terminal.pv)}</span></div>
              <div className="ledger-row total"><span>Enterprise value</span><span className="num">{money(r.enterpriseValue)}</span></div>
              <div className="ledger-row"><span>{inp.terminalMethod === "gordon" ? "Implied exit multiple" : "Implied perpetual growth"}</span><span className="num">{inp.terminalMethod === "gordon" ? mult(r.terminal.impliedExitMultiple) : pct(r.terminal.impliedGrowth)}</span></div>
            </div>
          </div>
          <div>
            <div className="block-title">Value per share</div>
            <div className="ledger">
              <div className="ledger-row"><span>Enterprise value</span><span className="num">{money(r.enterpriseValue)}</span></div>
              <div className="ledger-row"><span>Less debt</span><span className="num neg">({money(inp.debt)})</span></div>
              <div className="ledger-row"><span>Plus cash and investments</span><span className="num">{money(inp.cash)}</span></div>
              <div className="ledger-row"><span>Equity value</span><span className="num">{money(r.equityValue)}</span></div>
              <div className="ledger-row"><span>÷ shares (millions)</span><span className="num">{inp.sharesOutstanding.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span></div>
              <div className="ledger-row total"><span>Implied value per share</span><span className="num">{price(r.impliedPrice)}</span></div>
            </div>
          </div>
        </div>

        <div className="step-nav">
          <button className="btn ghost" onClick={() => ctx.go("inputs")}>Back to inputs</button>
          <button className="btn" onClick={() => ctx.go("results")}>See the valuation</button>
        </div>
      </section>
      <LiveRead ctx={ctx} />
    </div>
  );
}
