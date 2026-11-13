"use client";

import type { OptCtx } from "./OptionsTool";
import { OptLive } from "./OptLive";
import { YieldCurve } from "./YieldCurve";
import { matchedRate, rateNote } from "@/lib/optionRates";
import { Field, NumInput } from "../ui";
import { worstLevelFor } from "@/lib/checks";
import { pct, price } from "@/lib/format";
import { fmtDate } from "@/lib/market";
import { continuousRate, daysBetween, expiryIn, roundStrike } from "@/lib/optionModel";

export function ContractStage({ ctx }: { ctx: OptCtx }) {
  const { m, run, set, checks, market, rf } = ctx;
  const lvl = (f: string) => worstLevelFor(checks, f);
  const note = (id: string) => m.sources[id] && <span>{m.sources[id]}</span>;
  const strikes = [-0.1, -0.05, 0, 0.05, 0.1].map((d) => ({ d, k: roundStrike(m.S * (1 + d)) }));
  const expiries = [1, 3, 6, 12].map((mo) => ({ mo, date: expiryIn(m.valuationDate, mo) }));
  const latest = market && market.ticker === m.ticker ? market.last : null;
  const matched = rf ? matchedRate(rf, m.valuationDate, m.expiry) : null;

  return (
    <div className="bench wide">
      <section className="step">
        <h1>Set up the contract</h1>
        <p className="lede">
          An option gives you the right, but not the obligation, to buy (call) or sell (put) 100 shares at the strike price on or before the
          expiration date. Black-Scholes needs six numbers to price it. Valora fills in the market ones; you choose the contract.
        </p>

        <h2 className="section-h" style={{ marginTop: 32 }}>The contract</h2>
        <div className="body">
          <Field
            wide
            label="Type"
            help="A call profits when the stock rises; a put when it falls."
            input={
              <div className="seg" role="group" aria-label="Option type">
                <button aria-pressed={m.type === "call"} onClick={() => set({ type: "call" })}>Call</button>
                <button aria-pressed={m.type === "put"} onClick={() => set({ type: "put" })}>Put</button>
              </div>
            }
            notes={<span>Valora prices both. This choice decides which one the charts focus on.</span>}
          />
          <Field
            label="Strike price"
            help="The price you can buy or sell at."
            dot={lvl("K")}
            input={<NumInput kind="price" label="Strike price" level={lvl("K")} value={m.K} onChange={(n) => set({ K: n })} />}
            notes={
              <span className="chips">
                {strikes.map(({ d, k }) => (
                  <button key={d} className={`pick ${m.K === k ? "is-on" : ""}`} onClick={() => set({ K: k })}>
                    {d === 0 ? "At the money" : `${d > 0 ? "+" : ""}${d * 100}%`} {price(k)}
                  </button>
                ))}
              </span>
            }
          />
          <Field
            label="Expiration"
            help="Monthly options expire on the third Friday."
            dot={lvl("expiry")}
            input={
              <input
                type="date"
                className="text-input"
                aria-label="Expiration date"
                value={m.expiry}
                min={m.valuationDate}
                onChange={(e) => e.target.value && set({ expiry: e.target.value })}
              />
            }
            notes={
              <>
                <span className="chips">
                  {expiries.map(({ mo, date }) => (
                    <button key={mo} className={`pick ${m.expiry === date ? "is-on" : ""}`} onClick={() => set({ expiry: date })}>
                      {mo === 12 ? "1 year" : `${mo} month${mo > 1 ? "s" : ""}`}
                    </button>
                  ))}
                </span>
                <span>{run.days} days from {fmtDate(m.valuationDate)}, or {run.T.toFixed(3)} years.</span>
              </>
            }
          />
        </div>

        <h2 className="section-h">Market inputs</h2>
        <p className="section-p">Filled in from live data. Change any of them to see how the price responds.</p>
        <div className="body">
          <Field
            label="Share price"
            help={`As of ${fmtDate(m.priceDate)}`}
            input={<NumInput kind="price" label="Share price" value={m.S} onChange={(n) => set({ S: n }, ["S"])} />}
            notes={
              <>
                {note("S")}
                {latest && Math.abs(latest.c - m.S) > 0.005 && (
                  <span className="market-note">
                    <span className="ref">Last close: {price(latest.c)} on {fmtDate(latest.d)}</span>
                    <button className="btn ghost small" onClick={() => set({ S: Math.round(latest.c * 100) / 100, priceDate: latest.d })}>Use latest price</button>
                  </span>
                )}
              </>
            }
          />
          <Field
            label="Volatility"
            help="How much the stock moves in a year. The biggest driver of option prices."
            dot={lvl("sigma")}
            input={<NumInput kind="pct" label="Volatility" level={lvl("sigma")} value={m.sigma} onChange={(n) => set({ sigma: n }, ["sigma"])} />}
            notes={
              <>
                {note("sigma")}
                {m.histVol && Math.abs(m.histVol - m.sigma) > 0.0005 && (
                  <span className="market-note">
                    <span className="ref">Historical: {pct(m.histVol, 1)}</span>
                    <button className="btn ghost small" onClick={() => set({ sigma: Math.round(m.histVol! * 10000) / 10000 })}>Use historical</button>
                  </span>
                )}
                {run.impliedVol !== null && Math.abs(run.impliedVol - m.sigma) > 0.0005 && (
                  <span className="market-note">
                    <span className="ref">Implied by your market price: {pct(run.impliedVol, 1)}</span>
                    <button className="btn ghost small" onClick={() => set({ sigma: Math.round(run.impliedVol! * 10000) / 10000 })}>Use implied</button>
                  </span>
                )}
              </>
            }
          />
          <Field
            label="Risk-free rate"
            help="Treasury yield for the option's life, as quoted."
            input={<NumInput kind="pct" label="Risk-free rate" value={m.treasury} onChange={(n) => set({ treasury: n }, ["treasury"])} />}
            notes={
              <>
                {note("treasury")}
                <span className="ref">
                  Black-Scholes uses continuous compounding: 2 × ln(1 + {pct(m.treasury, 2)} / 2) = {pct(continuousRate(m.treasury), 2)}.
                </span>
                {rf && (rf.curve || rf.live) && Math.abs(matched!.treasury - m.treasury) > 0.00005 && (
                  <span className="market-note">
                    <button
                      className="btn ghost small"
                      onClick={() => set({ ...matched!, sources: { ...m.sources, treasury: rateNote(rf, m.valuationDate, m.expiry) } })}
                    >
                      Use the matching Treasury yield ({pct(matched!.treasury, 2)})
                    </button>
                  </span>
                )}
              </>
            }
          />
          {rf?.curve && <YieldCurve curve={rf.curve} years={run.T} used={m.treasury} />}
          <Field
            label="Dividend yield"
            help="Dividends a year divided by the share price."
            dot={lvl("q")}
            input={<NumInput kind="pct" label="Dividend yield" level={lvl("q")} value={m.q} onChange={(n) => set({ q: n }, ["q"])} />}
            notes={note("q")}
          />
        </div>

        <h2 className="section-h">Market price (optional)</h2>
        <p className="section-p">
          If you can see what this {m.type} trades for on a brokerage or finance site, enter it. Valora works backward to the volatility the
          market is pricing in.
        </p>
        <div className="body">
          <Field
            label={`Market price of the ${m.type}`}
            help="Per share, not per contract. Use the midpoint of the bid and ask."
            dot={m.marketPrice ? lvl("marketPrice") : undefined}
            input={
              <NumInput
                kind="price"
                label="Market option price"
                value={m.marketPrice ?? NaN}
                onChange={(n) => set({ marketPrice: n > 0 ? n : null })}
              />
            }
            notes={
              m.marketPrice ? (
                run.impliedVol !== null ? (
                  <span className="ref">Implied volatility: {pct(run.impliedVol, 1)}</span>
                ) : (
                  <span>No volatility produces this price. Check the strike, date and type.</span>
                )
              ) : (
                <span>Leave blank to skip.</span>
              )
            }
          />
        </div>

        <div className="step-nav">
          <span className="muted" style={{ fontSize: "var(--step--1)" }}>
            {daysBetween(m.valuationDate, m.expiry) <= 0 ? "Pick an expiration after today to see prices." : ""}
          </span>
          <button className="btn" onClick={() => ctx.go("model")}>See the formula</button>
        </div>
      </section>
      <OptLive ctx={ctx} />
    </div>
  );
}
