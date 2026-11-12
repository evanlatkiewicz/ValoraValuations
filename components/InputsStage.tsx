"use client";

import { useState } from "react";
import type { Ctx } from "./Valora";
import { Dot, Field, NumInput, SourceNote, SourceTag } from "./ui";
import { LiveRead } from "./LiveRead";
import { worstLevelFor } from "@/lib/checks";
import { baseYear, projectionLabels } from "@/lib/dcf";
import { money, moneyB, mult, pct } from "@/lib/format";
import { fmtDate } from "@/lib/market";
import type { DcfInputs, HistoricalYear } from "@/lib/types";

const STEPS = [
  "The business",
  "Revenue",
  "Operating margin",
  "Taxes and reinvestment",
  "Balance sheet",
  "Discount rate",
  "Terminal value",
];

/** Which input ids belong to which step. Used for the rail dots and issue links. */
export const STEP_FIELDS: string[][] = [
  ["history"],
  ["revenueGrowth"],
  ["ebitMargin"],
  ["taxRate", "daPct", "capexPct", "nwcPct", "baseNwc"],
  ["sharePrice", "sharesOutstanding", "cash", "debt"],
  ["riskFreeRate", "beta", "equityRiskPremium", "preTaxCostOfDebt"],
  ["terminalGrowth", "exitMultiple"],
];

/** Whether a step's own inputs are filled in. */
function stepComplete(i: DcfInputs, step: number): boolean {
  const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x));
  switch (step) {
    case 0: {
      const base = i.history[i.history.length - 1];
      return i.history.every((y) => y.revenue > 0) && base.ebit !== 0 && base.da > 0;
    }
    case 1: return i.revenueGrowth.length === 5 && ok(...i.revenueGrowth);
    case 2: return i.ebitMargin.length === 5 && ok(...i.ebitMargin);
    case 3: return ok(i.taxRate, i.daPct, i.capexPct, i.nwcPct, i.baseNwc);
    case 4: return i.sharePrice > 0 && i.sharesOutstanding > 0;
    case 5: return ok(i.riskFreeRate, i.beta, i.equityRiskPremium, i.preTaxCostOfDebt);
    case 6: return i.terminalMethod === "gordon" ? ok(i.terminalGrowth) : ok(i.exitMultiple);
    default: return false;
  }
}

export function InputsStage({ ctx, step, setStep }: { ctx: Ctx; step: number; setStep: (n: number) => void }) {
  const levelForStep = (i: number) => {
    // Filled-in steps show the worst sanity check on them, or green if none.
    // Until the model can run (it needs revenue, shares and a price), a dot
    // just shows whether that step is filled in.
    if (!stepComplete(ctx.inputs, i)) return null;
    const ls = ctx.ready ? STEP_FIELDS[i].map((f) => worstLevelFor(ctx.checks, f)).filter(Boolean) : [];
    if (ls.length === 0) return "good";
    return ls.includes("bad") ? "bad" : ls.includes("warn") ? "warn" : "good";
  };
  const goStep = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="bench">
      <nav className="rail" aria-label="Input steps">
        <ol>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button aria-current={step === i ? "step" : undefined} onClick={() => goStep(i)}>
                <span className="n">{i + 1}</span>
                <span>{s}</span>
                <Dot level={levelForStep(i)} />
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="step" aria-labelledby="step-title">
        {step === 0 && <Business ctx={ctx} />}
        {step === 1 && <Revenue ctx={ctx} />}
        {step === 2 && <Margins ctx={ctx} />}
        {step === 3 && <Reinvestment ctx={ctx} />}
        {step === 4 && <BalanceSheet ctx={ctx} />}
        {step === 5 && <DiscountRate ctx={ctx} />}
        {step === 6 && <Terminal ctx={ctx} />}

        <div className="step-nav">
          {step > 0 ? (
            <button className="btn ghost" onClick={() => goStep(step - 1)}>Back: {STEPS[step - 1]}</button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn" onClick={() => goStep(step + 1)}>Next: {STEPS[step + 1]}</button>
          ) : (
            <button className="btn" onClick={() => ctx.go("model")}>Compile the model</button>
          )}
        </div>
      </section>

      <LiveRead ctx={ctx} onIssue={goStep} />
    </div>
  );
}

/* ---------- helpers ---------- */

function useField(ctx: Ctx) {
  return {
    lvl: (id: string) => (ctx.ready ? worstLevelFor(ctx.checks, id) : null),
    src: (id: string) => ctx.inputs.sources[id],
    set: <K extends keyof DcfInputs>(key: K, value: DcfInputs[K]) =>
      ctx.update({ [key]: value } as Partial<DcfInputs>, [key as string]),
  };
}

function Notes({ ctx, id, extra }: { ctx: Ctx; id: string; extra?: React.ReactNode }) {
  const s = ctx.inputs.sources[id];
  return (
    <>
      {extra}
      <SourceTag source={s} />
      <SourceNote source={s} />
    </>
  );
}

function histRatios(h: HistoricalYear[]) {
  return h.map((y, i) => ({
    label: y.label,
    growth: i > 0 && h[i - 1].revenue > 0 ? y.revenue / h[i - 1].revenue - 1 : NaN,
    margin: y.revenue > 0 ? y.ebit / y.revenue : NaN,
    da: y.revenue > 0 ? y.da / y.revenue : NaN,
    capex: y.revenue > 0 ? y.capex / y.revenue : NaN,
  }));
}

/* ---------- Step 1: business ---------- */

function Business({ ctx }: { ctx: Ctx }) {
  const { inputs, update } = ctx;
  const h = inputs.history;
  const setHist = (i: number, key: keyof HistoricalYear, v: number | string) => {
    const next = h.map((y, j) => (j === i ? { ...y, [key]: v } : y));
    update({ history: next }, ["history"]);
  };
  const addYear = () => {
    const first = h[0];
    const m = first.label.match(/^(.*?)(\d{4})$/);
    const label = m ? `${m[1]}${Number(m[2]) - 1}` : "Prior year";
    update({ history: [{ label, revenue: 0, ebit: 0, da: 0, capex: 0 }, ...h] }, ["history"]);
  };
  const removeFirst = () => h.length > 1 && update({ history: h.slice(1) }, ["history"]);
  const ratios = histRatios(h);
  const rows: { key: keyof HistoricalYear; label: string; where: string }[] = [
    { key: "revenue", label: "Revenue", where: "Income statement, top line" },
    { key: "ebit", label: "Operating income (EBIT)", where: "Income statement" },
    { key: "da", label: "D&A", where: "Cash flow statement, operating section" },
    { key: "capex", label: "Capex", where: "Cash flow statement, investing section" },
  ];

  return (
    <>
      <h1 id="step-title">Start with what the company actually did</h1>
      <p className="lede">
        Every projection grows out of the most recent full year, called the base year. Enter a few years of history so you can see the trend
        before you forecast it. All dollar figures are in millions.
      </p>
      <div className="body">
        <Field
          label="Company name"
          input={<input className="text-input" value={inputs.company.name} onChange={(e) => update({ company: { ...inputs.company, name: e.target.value } }, [])} />}
        />
        <Field
          label="Ticker"
          input={<input className="text-input" value={inputs.company.ticker} onChange={(e) => update({ company: { ...inputs.company, ticker: e.target.value.toUpperCase() } }, [])} />}
        />
      </div>

      <h2 className="section-h" style={{ marginTop: 32 }}>Historical results</h2>
      <p className="section-p">
        Capex shows up on the cash flow statement as &ldquo;payments for acquisition of property, plant and equipment.&rdquo; Enter it as a positive number.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="grid-table">
          <thead>
            <tr>
              <th>Fiscal year</th>
              {h.map((y, i) => (
                <th key={i}>
                  <input
                    className="text-input"
                    style={{ width: 96, textAlign: "right", height: 30, fontWeight: 600 }}
                    value={y.label}
                    aria-label="Fiscal year label"
                    onChange={(e) => setHist(i, "label", e.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="label">
                  {r.label}
                  <div className="field-help">{r.where}</div>
                </td>
                {h.map((y, i) => (
                  <td key={i}>
                    <NumInput kind="money" label={`${r.label} ${y.label}`} value={y[r.key] as number} onChange={(n) => setHist(i, r.key, n)} />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="label faint">Revenue growth</td>
              {ratios.map((r, i) => <td key={i} className="num faint">{isFinite(r.growth) ? pct(r.growth) : ""}</td>)}
            </tr>
            <tr>
              <td className="label faint">Operating margin</td>
              {ratios.map((r, i) => <td key={i} className="num faint">{isFinite(r.margin) ? pct(r.margin) : ""}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="quickfill">
        {h.length < 5 && <button className="btn ghost small" onClick={addYear}>Add an earlier year</button>}
        {h.length > 1 && <button className="btn ghost small" onClick={removeFirst}>Remove {h[0].label}</button>}
        <span>The right-most year is your base year ({baseYear(inputs).label}).</span>
      </div>
      <div className="field-notes" style={{ marginTop: 12 }}>
        <SourceTag source={inputs.sources.history} />
        <SourceNote source={inputs.sources.history} />
      </div>
    </>
  );
}

/* ---------- Year-by-year row with quick fill ---------- */

function YearRow({
  ctx,
  field,
  histKey,
  rowLabel,
  values,
  onChange,
  fillLabel,
}: {
  ctx: Ctx;
  field: string;
  histKey: "growth" | "margin";
  rowLabel: string;
  values: number[];
  onChange: (v: number[]) => void;
  fillLabel: string;
}) {
  const ratios = histRatios(ctx.inputs.history).slice(histKey === "growth" ? 1 : 0);
  const labels = projectionLabels(ctx.inputs.company.baseYearLabel);
  const [from, setFrom] = useState(values[0]);
  const [to, setTo] = useState(values[4]);
  const level = ctx.ready ? worstLevelFor(ctx.checks, field) : null;
  const fill = () => onChange(values.map((_, i) => from + ((to - from) * i) / 4));

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table className="grid-table">
          <thead>
            <tr>
              <th />
              {ratios.map((r) => <th key={r.label} className="actual">{r.label}<div className="faint" style={{ fontWeight: 400 }}>actual</div></th>)}
              {labels.map((l) => <th key={l}>{l}<div className="faint" style={{ fontWeight: 400 }}>projected</div></th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="label"><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Dot level={level} />{rowLabel}</span></td>
              {ratios.map((r) => <td key={r.label} className="actual num">{pct(r[histKey])}</td>)}
              {values.map((v, i) => (
                <td key={i}>
                  <NumInput kind="pct" level={level} label={`${rowLabel} ${labels[i]}`} value={v} onChange={(n) => onChange(values.map((x, j) => (j === i ? n : x)))} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="quickfill">
        <span>{fillLabel}</span>
        <NumInput kind="pct" label="Start" value={from} onChange={setFrom} />
        <span>to</span>
        <NumInput kind="pct" label="End" value={to} onChange={setTo} />
        <button className="btn ghost small" onClick={fill}>Fill all five years</button>
      </div>
      <div className="field-notes" style={{ marginTop: 14 }}>
        <Notes ctx={ctx} id={field} />
      </div>
    </>
  );
}

/* ---------- Step 2: revenue ---------- */

function Revenue({ ctx }: { ctx: Ctx }) {
  const { set } = useField(ctx);
  const r = ctx.result;
  return (
    <>
      <h1 id="step-title">How fast will revenue grow?</h1>
      <p className="lede">
        Revenue is the top of the model, so every other line depends on it. A common approach is to start near recent growth and fade toward a
        long-run rate by year five, because fast growth gets harder to sustain as a company gets bigger.
      </p>
      <div className="body">
        <YearRow
          ctx={ctx}
          field="revenueGrowth"
          histKey="growth"
          rowLabel="Revenue growth"
          values={ctx.inputs.revenueGrowth}
          onChange={(v) => set("revenueGrowth", v)}
          fillLabel="Fade growth from"
        />
        <p className="muted" style={{ marginTop: 18, fontSize: "var(--step--1)" }}>
          Year 5 revenue: <span className="num">${money(r.years[4].revenue)}M</span>, up from{" "}
          <span className="num">${money(baseYear(ctx.inputs).revenue)}M</span> in the base year.
        </p>
      </div>
    </>
  );
}

/* ---------- Step 3: margins ---------- */

function Margins({ ctx }: { ctx: Ctx }) {
  const { set } = useField(ctx);
  return (
    <>
      <h1 id="step-title">How much of each dollar becomes operating profit?</h1>
      <p className="lede">
        Operating margin is operating income (EBIT) divided by revenue. It captures pricing power and cost discipline. If you expect margins to
        rise, you should be able to say why: scale, a shift toward higher-margin products, or cost cuts.
      </p>
      <div className="body">
        <YearRow
          ctx={ctx}
          field="ebitMargin"
          histKey="margin"
          rowLabel="Operating margin"
          values={ctx.inputs.ebitMargin}
          onChange={(v) => set("ebitMargin", v)}
          fillLabel="Move margin from"
        />
      </div>
    </>
  );
}

/* ---------- Step 4: taxes and reinvestment ---------- */

function Reinvestment({ ctx }: { ctx: Ctx }) {
  const { lvl, set } = useField(ctx);
  const i = ctx.inputs;
  const last = histRatios(i.history).at(-1)!;
  const base = baseYear(i);
  return (
    <>
      <h1 id="step-title">Turn profit into free cash flow</h1>
      <p className="lede">
        A company doesn&rsquo;t get to keep all of its operating profit. It pays taxes, and it reinvests in equipment and working capital to keep
        growing. Free cash flow is what&rsquo;s left: EBIT after tax, plus D&amp;A, minus capex, minus the increase in working capital.
      </p>
      <div className="body">
        <Field
          label="Tax rate"
          help="Effective rate: income tax expense divided by pre-tax income."
          dot={lvl("taxRate")}
          input={<NumInput kind="pct" label="Tax rate" level={lvl("taxRate")} value={i.taxRate} onChange={(n) => set("taxRate", n)} />}
          notes={<Notes ctx={ctx} id="taxRate" />}
        />
        <Field
          label="D&A, % of revenue"
          help="Added back because it is a non-cash expense."
          dot={lvl("daPct")}
          input={<NumInput kind="pct" label="D&A percent of revenue" level={lvl("daPct")} value={i.daPct} onChange={(n) => set("daPct", n)} />}
          notes={<Notes ctx={ctx} id="daPct" extra={<span className="ref">Base year: {pct(last.da)}</span>} />}
        />
        <Field
          label="Capex, % of revenue"
          help="Cash spent on property and equipment."
          dot={lvl("capexPct")}
          input={<NumInput kind="pct" label="Capex percent of revenue" level={lvl("capexPct")} value={i.capexPct} onChange={(n) => set("capexPct", n)} />}
          notes={<Notes ctx={ctx} id="capexPct" extra={<span className="ref">Base year: {pct(last.capex)}</span>} />}
        />
        <Field
          label="Working capital, % of revenue"
          help="Receivables plus inventory minus payables. When it grows, it uses cash."
          dot={lvl("nwcPct")}
          input={<NumInput kind="pct" label="Working capital percent of revenue" level={lvl("nwcPct")} value={i.nwcPct} onChange={(n) => set("nwcPct", n)} />}
          notes={
            <Notes
              ctx={ctx}
              id="nwcPct"
              extra={
                <span className="ref">
                  Base year: {base.revenue > 0 ? pct(i.baseNwc / base.revenue) : "n/a"}
                  {i.nwcPct < 0 && ". Negative means suppliers fund the business, so growth brings cash in."}
                </span>
              }
            />
          }
        />
        <Field
          label="Base year working capital"
          help="Current operating assets minus current operating liabilities. Leave out cash and debt."
          input={<NumInput kind="money" label="Base year working capital" value={i.baseNwc} onChange={(n) => set("baseNwc", n)} />}
          notes={<Notes ctx={ctx} id="baseNwc" />}
        />
      </div>
    </>
  );
}

/* ---------- Step 5: balance sheet ---------- */

function BalanceSheet({ ctx }: { ctx: Ctx }) {
  const { set } = useField(ctx);
  const i = ctx.inputs;
  const mcap = i.sharePrice * i.sharesOutstanding;
  return (
    <>
      <h1 id="step-title">What does the market say it&rsquo;s worth today?</h1>
      <p className="lede">
        The DCF produces an enterprise value, the value of the whole business. To get to a price per share you subtract debt, add back cash, and
        divide by shares. The current price is also what you&rsquo;ll compare your answer to.
      </p>
      <div className="body">
        <Field
          label="Share price"
          help={i.company.priceDate ? `As of ${i.company.priceDate}` : "Today's price"}
          input={<NumInput kind="price" label="Share price" value={i.sharePrice} onChange={(n) =>
                ctx.update(
                  { sharePrice: n, company: { ...i.company, priceDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } },
                  ["sharePrice"],
                )
              } />}
          notes={
            <Notes
              ctx={ctx}
              id="sharePrice"
              extra={
                ctx.market && ctx.market.ticker === i.company.ticker.toUpperCase() ? (
                  <span className="market-note">
                    <span className="ref">Last close: ${ctx.market.last.c.toFixed(2)} on {fmtDate(ctx.market.last.d)}</span>
                    {Math.abs(ctx.market.last.c - i.sharePrice) > 0.005 && (
                      <button className="btn ghost small" onClick={ctx.applyPrice}>Use latest price</button>
                    )}
                  </span>
                ) : i.company.ticker ? (
                  <a href={`https://finance.yahoo.com/quote/${encodeURIComponent(i.company.ticker)}`} target="_blank" rel="noreferrer">
                    Look up {i.company.ticker}&rsquo;s price
                  </a>
                ) : undefined
              }
            />
          }
        />
        <Field
          label="Shares outstanding"
          help="In millions. From the cover of the 10-K or the balance sheet."
          input={<NumInput kind="shares" label="Shares outstanding" value={i.sharesOutstanding} onChange={(n) => set("sharesOutstanding", n)} />}
          notes={<Notes ctx={ctx} id="sharesOutstanding" />}
        />
        <Field
          label="Cash and investments"
          help="Cash plus marketable securities."
          input={<NumInput kind="money" label="Cash and investments" value={i.cash} onChange={(n) => set("cash", n)} />}
          notes={<Notes ctx={ctx} id="cash" />}
        />
        <Field
          label="Total debt"
          help="Short-term and long-term borrowings."
          input={<NumInput kind="money" label="Total debt" value={i.debt} onChange={(n) => set("debt", n)} />}
          notes={<Notes ctx={ctx} id="debt" />}
        />
      </div>
      <div className="ledger">
        <div className="ledger-row"><span>Market cap<div className="formula">price × shares</div></span><span className="num">{moneyB(mcap)}</span></div>
        <div className="ledger-row"><span>Plus debt</span><span className="num">{moneyB(i.debt)}</span></div>
        <div className="ledger-row"><span>Less cash</span><span className="num neg">({moneyB(i.cash)})</span></div>
        <div className="ledger-row total"><span>Market enterprise value</span><span className="num">{moneyB(mcap + i.debt - i.cash)}</span></div>
      </div>
    </>
  );
}

/* ---------- Step 6: discount rate ---------- */

function DiscountRate({ ctx }: { ctx: Ctx }) {
  const { lvl, set } = useField(ctx);
  const i = ctx.inputs;
  const w = ctx.result.wacc;
  return (
    <>
      <h1 id="step-title">What return do investors require?</h1>
      <p className="lede">
        A dollar next year is worth less than a dollar today. The weighted average cost of capital (WACC) is the rate you discount future cash
        flows at. It blends what shareholders expect to earn with what lenders charge, weighted by how much of each the company uses.
      </p>
      <div className="body">
        <Field
          label="Risk-free rate"
          help="Yield on the 10-year US Treasury."
          dot={lvl("riskFreeRate")}
          input={<NumInput kind="pct" label="Risk-free rate" level={lvl("riskFreeRate")} value={i.riskFreeRate} onChange={(n) => set("riskFreeRate", n)} />}
          notes={<Notes ctx={ctx} id="riskFreeRate" />}
        />
        <Field
          label="Beta"
          help="How much the stock moves with the market. 1.0 moves with it."
          dot={lvl("beta")}
          input={<NumInput kind="num" label="Beta" level={lvl("beta")} value={i.beta} onChange={(n) => set("beta", n)} />}
          notes={
            <Notes
              ctx={ctx}
              id="beta"
              extra={
                ctx.market?.beta && ctx.market.ticker === i.company.ticker.toUpperCase() && Math.abs(ctx.market.beta.adjusted - i.beta) > 0.005 ? (
                  <span className="market-note">
                    <span className="ref">Calculated from prices: {ctx.market.beta.adjusted.toFixed(2)}</span>
                    <button className="btn ghost small" onClick={ctx.applyBeta}>Use calculated beta</button>
                  </span>
                ) : undefined
              }
            />
          }
        />
        <Field
          label="Equity risk premium"
          help="Extra return investors want for owning stocks instead of Treasuries."
          dot={lvl("equityRiskPremium")}
          input={<NumInput kind="pct" label="Equity risk premium" level={lvl("equityRiskPremium")} value={i.equityRiskPremium} onChange={(n) => set("equityRiskPremium", n)} />}
          notes={<Notes ctx={ctx} id="equityRiskPremium" />}
        />
        <Field
          label="Pre-tax cost of debt"
          help="The rate the company pays to borrow today."
          dot={lvl("preTaxCostOfDebt")}
          input={<NumInput kind="pct" label="Pre-tax cost of debt" level={lvl("preTaxCostOfDebt")} value={i.preTaxCostOfDebt} onChange={(n) => set("preTaxCostOfDebt", n)} />}
          notes={<Notes ctx={ctx} id="preTaxCostOfDebt" />}
        />
      </div>
      <div className="ledger">
        <div className="ledger-row"><span>Cost of equity<div className="formula">{pct(i.riskFreeRate, 2)} + {i.beta.toFixed(2)} × {pct(i.equityRiskPremium, 2)}</div></span><span className="num">{pct(w.costOfEquity, 2)}</span></div>
        <div className="ledger-row"><span>After-tax cost of debt<div className="formula">{pct(i.preTaxCostOfDebt, 2)} × (1 − {pct(i.taxRate)})</div></span><span className="num">{pct(w.afterTaxCostOfDebt, 2)}</span></div>
        <div className="ledger-row"><span>Equity weight<div className="formula">market cap / (market cap + debt)</div></span><span className="num">{pct(w.equityWeight)}</span></div>
        <div className="ledger-row"><span>Debt weight</span><span className="num">{pct(w.debtWeight)}</span></div>
        <div className="ledger-row total"><span>WACC</span><span className="num">{pct(w.wacc, 2)}</span></div>
      </div>
    </>
  );
}

/* ---------- Step 7: terminal value ---------- */

function Terminal({ ctx }: { ctx: Ctx }) {
  const { lvl, set } = useField(ctx);
  const i = ctx.inputs;
  const r = ctx.result;
  const gordon = i.terminalMethod === "gordon";
  return (
    <>
      <h1 id="step-title">What is the business worth after year five?</h1>
      <p className="lede">
        You can&rsquo;t forecast forever, so the terminal value stands in for every year after the projection. It is usually the biggest piece
        of the valuation. There are two standard ways to estimate it, and checking one against the other is good practice.
      </p>
      <div className="body">
        <Field
          wide
          label="Method"
          input={
            <div className="seg" role="group" aria-label="Terminal value method">
              <button aria-pressed={gordon} onClick={() => ctx.update({ terminalMethod: "gordon" }, [])}>Perpetuity growth</button>
              <button aria-pressed={!gordon} onClick={() => ctx.update({ terminalMethod: "exit" }, [])}>Exit multiple</button>
            </div>
          }
          notes={
            gordon ? (
              <span>Assumes year 5 cash flow grows at a steady rate forever. Value = FCF × (1 + g) / (WACC − g).</span>
            ) : (
              <span>Assumes the business is sold at the end of year 5 for a multiple of EBITDA, like comparable companies trade at.</span>
            )
          }
        />
        {gordon ? (
          <Field
            label="Terminal growth rate"
            help="Growth forever. Usually 2% to 3%."
            dot={lvl("terminalGrowth")}
            input={<NumInput kind="pct" label="Terminal growth rate" level={lvl("terminalGrowth")} value={i.terminalGrowth} onChange={(n) => set("terminalGrowth", n)} />}
            notes={<Notes ctx={ctx} id="terminalGrowth" extra={<span className="ref">Implies {mult(r.terminal.impliedExitMultiple)} year-5 EBITDA</span>} />}
          />
        ) : (
          <Field
            label="Exit multiple"
            help="Enterprise value / EBITDA."
            dot={lvl("exitMultiple")}
            input={<NumInput kind="mult" label="Exit multiple" level={lvl("exitMultiple")} value={i.exitMultiple} onChange={(n) => set("exitMultiple", n)} />}
            notes={<Notes ctx={ctx} id="exitMultiple" extra={<span className="ref">Implies {pct(r.terminal.impliedGrowth)} growth forever</span>} />}
          />
        )}
        <Field
          label="Mid-year convention"
          help="Treats each year's cash as arriving mid-year, not on the last day."
          input={
            <label className="check">
              <input type="checkbox" checked={i.midYear} onChange={(e) => ctx.update({ midYear: e.target.checked }, [])} />
              {i.midYear ? "On" : "Off"}
            </label>
          }
          notes={<span>Banks often turn this on. It raises the value slightly because cash is received sooner.</span>}
        />
      </div>
      <div className="ledger">
        <div className="ledger-row"><span>Terminal value at end of year 5</span><span className="num">{moneyB(r.terminal.value)}</span></div>
        <div className="ledger-row"><span>Discounted to today<div className="formula">× {r.terminal.discountFactor.toFixed(4)}</div></span><span className="num">{moneyB(r.terminal.pv)}</span></div>
        <div className="ledger-row total"><span>Share of enterprise value</span><span className="num">{pct(r.terminalShareOfEv, 0)}</span></div>
      </div>
    </>
  );
}
