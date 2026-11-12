"use client";

import { useMemo } from "react";
import type { Ctx } from "./Valora";
import { LiveRead } from "./LiveRead";
import { Dot, Stars } from "./ui";
import { C_FCF, C_PV, FcfChart, Waterfall } from "./charts";
import { reverseDcf, sensitivity } from "@/lib/dcf";
import { mult, pct, price, signedPct } from "@/lib/format";

function cellColor(p: number, market: number) {
  if (!isFinite(p)) return "transparent";
  const d = p / market - 1;
  if (Math.abs(d) <= 0.05) return "#e4e6e1"; // neutral midpoint
  const a = Math.min(1, (Math.abs(d) - 0.05) / 0.45);
  // interpolate from light to stronger tint
  return d > 0
    ? `color-mix(in oklab, #d6e4d6 ${100 - a * 100}%, #9cc3a6)`
    : `color-mix(in oklab, #f1d9d3 ${100 - a * 100}%, #e3a59a)`;
}

export function ResultsStage({ ctx }: { ctx: Ctx }) {
  const { inputs: inp, result: r, checks, stars, ready } = ctx;
  const gordon = inp.terminalMethod === "gordon";

  const sens = useMemo(
    () =>
      ready
        ? sensitivity(inp, [-0.01, -0.005, 0, 0.005, 0.01], gordon ? [-0.01, -0.005, 0, 0.005, 0.01] : [-4, -2, 0, 2, 4])
        : null,
    [inp, ready, gordon],
  );
  const rev = useMemo(() => (ready ? reverseDcf(inp) : null), [inp, ready]);

  if (!ready || !sens || !rev) {
    return (
      <div className="bench wide">
        <div className="empty">
          <h2>Nothing to value yet</h2>
          <p>Add {ctx.missing.join(", ").toLowerCase()} first. The valuation, charts and sanity checks will show up here.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => ctx.go("inputs", 0)}>Go to inputs</button>
        </div>
        <LiveRead ctx={ctx} />
      </div>
    );
  }

  const name = inp.company.name || "this company";
  const below = r.upside < 0;
  const order = { bad: 0, warn: 1, good: 2 } as const;
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <div className="bench full">
      <section>
        <div className="verdict">
          <div>
            <div className="cap">Implied value per share</div>
            <div className={`big ${r.impliedPrice < 0 ? "neg" : ""}`}>{price(r.impliedPrice)}</div>
          </div>
          <div>
            <div className="cap">Market price{inp.company.priceDate ? `, ${inp.company.priceDate}` : ""}</div>
            <div className="delta">{price(inp.sharePrice)}</div>
            <div className={`num ${below ? "neg" : ""}`} style={{ fontWeight: 600, marginTop: 4 }}>{signedPct(r.upside)}</div>
          </div>
          {r.years[4].ufcf <= 0 || r.enterpriseValue <= 0 ? (
            <p className="say warn-say">
              Don&rsquo;t trust this number yet. Free cash flow is still negative in year 5, so the model assumes {name} burns cash forever,
              and the value mostly reflects the cash on its balance sheet. See the red checks below.
            </p>
          ) : (
            <p className="say">
              Based on your assumptions, {name} is worth {price(r.impliedPrice)} a share, {pct(Math.abs(r.upside), 0)}{" "}
              {below ? "below" : "above"} where it trades. Before trusting that, look at what drives it and how sensitive it is.
            </p>
          )}
        </div>

        <div className="stars-line" style={{ marginTop: 18 }}>
          <Stars value={stars} size={22} />
          <span style={{ fontWeight: 700 }}>{stars.toFixed(1)} out of 5</span>
          <span className="muted" style={{ fontSize: "var(--step--1)" }}>
            Model quality: {checks.filter((c) => c.level === "good").length} of {checks.length} checks green
          </span>
        </div>

        <div className="charts" style={{ marginTop: 28 }}>
          <div className="chart-box">
            <h3>From cash flows to equity value</h3>
            <p>Most of the value usually comes from the terminal value.</p>
            <Waterfall
              steps={[
                { label: "PV of\nyears 1-5", value: r.sumPvUfcf, kind: "add" },
                { label: "PV of\nterminal", value: r.terminal.pv, kind: "add" },
                { label: "Enterprise\nvalue", value: r.enterpriseValue, kind: "total" },
                { label: "Less\ndebt", value: inp.debt, kind: "sub" },
                { label: "Plus\ncash", value: inp.cash, kind: "add" },
                { label: "Equity\nvalue", value: r.equityValue, kind: "total" },
              ]}
            />
          </div>
          <div className="chart-box">
            <h3>Free cash flow, and what it&rsquo;s worth today</h3>
            <p>The gap between the bars is the cost of waiting at a {pct(r.wacc.wacc, 1)} WACC.</p>
            <div className="legend">
              <span><i style={{ background: C_FCF }} />Free cash flow</span>
              <span><i style={{ background: C_PV }} />Present value</span>
            </div>
            <FcfChart labels={r.years.map((y) => y.label)} fcf={r.years.map((y) => y.ufcf)} pv={r.years.map((y) => y.pvUfcf)} />
          </div>
        </div>

        <h2 className="section-h">What the market is pricing in</h2>
        <p className="section-p">
          This is a reverse DCF. It holds everything else constant and asks what one assumption would have to be for the model to land exactly on
          today&rsquo;s price of {price(inp.sharePrice)}.
        </p>
        <div className="reverse">
          <div>
            <div className="rv-cap">WACC needed</div>
            <div className="rv">{rev.wacc !== null ? pct(rev.wacc, 2) : "n/a"}</div>
            <p>
              You used {pct(r.wacc.wacc, 2)}.{" "}
              {rev.wacc !== null &&
                (rev.wacc < r.wacc.wacc
                  ? "The market is discounting this company's cash flows at a lower rate than you are, which means it sees them as safer."
                  : "The market is applying a higher discount rate than you, which means it sees more risk.")}
            </p>
          </div>
          <div>
            <div className="rv-cap">{gordon ? "Terminal growth needed" : "Exit multiple needed"}</div>
            <div className="rv">
              {gordon ? (rev.terminalGrowth !== null ? pct(rev.terminalGrowth, 2) : "n/a") : rev.exitMultiple !== null ? mult(rev.exitMultiple) : "n/a"}
            </div>
            <p>
              You used {gordon ? pct(inp.terminalGrowth, 1) : mult(inp.exitMultiple)}.{" "}
              {gordon && rev.terminalGrowth !== null && rev.terminalGrowth > 0.04
                ? "That is faster than the economy is expected to grow forever, so the market is likely also expecting more growth in the next five years than your forecast has."
                : gordon && rev.terminalGrowth === null
                  ? "No reasonable growth rate gets there with your other inputs."
                  : "Ask whether that is a believable long-run outcome."}
            </p>
          </div>
        </div>

        <h2 className="section-h">Sensitivity</h2>
        <p className="section-p">
          Small changes in the two biggest assumptions move the answer a lot. Each cell is the implied share price. Green is above today&rsquo;s
          price, red is below, gray is within 5%. The outlined cell is your base case.
        </p>
        <div className="sens-wrap">
          <table className="sens">
            <caption>WACC (rows) and {gordon ? "terminal growth" : "exit multiple"} (columns)</caption>
            <thead>
              <tr>
                <th />
                {sens.terminals.map((t) => <th key={t} scope="col">{gordon ? pct(t, 1) : mult(t)}</th>)}
              </tr>
            </thead>
            <tbody>
              {sens.waccs.map((w, i) => (
                <tr key={w}>
                  <th scope="row">{pct(w, 2)}</th>
                  {sens.prices[i].map((p, j) => (
                    <td key={j} className={i === 2 && j === 2 ? "center" : ""} style={{ background: cellColor(p, inp.sharePrice) }}>
                      {isFinite(p) ? price(p) : "n/a"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sens-key">
            <span><i style={{ background: "#9cc3a6" }} />Well above market price</span>
            <span><i style={{ background: "#e4e6e1" }} />Within 5% of market price</span>
            <span><i style={{ background: "#e3a59a" }} />Well below market price</span>
          </div>
        </div>

        <h2 className="section-h">Sanity checks</h2>
        <p className="section-p">
          Each check compares an input or result to the range most analysts would consider normal. Yellow costs half a star, red costs a full
          star. A yellow isn&rsquo;t wrong, but you should be able to explain it.
        </p>
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
          <button className="btn ghost" onClick={() => ctx.go("inputs", 1)}>Change assumptions</button>
        </div>
      </section>
    </div>
  );
}
