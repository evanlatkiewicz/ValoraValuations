"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ctx } from "./Valora";
import { readComps, type PeerRow } from "@/lib/comps";
import { mult, moneyB, price, signedPct } from "@/lib/format";

type Data = { self: PeerRow | null; peers: PeerRow[] };

const m = (x: number | null) => (x !== null && Number.isFinite(x) && x > 0 && x < 1000 ? mult(x) : "n/a");

/** How similar companies trade, and what this company is worth at their multiples. */
export function PeersSection({ ctx }: { ctx: Ctx }) {
  const { inputs: inp, result: r, update } = ctx;
  const ticker = inp.company.ticker;
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "none">("idle");

  useEffect(() => {
    if (!ticker) return;
    let live = true;
    setState("loading");
    fetch(`/api/peers?ticker=${encodeURIComponent(ticker)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: Data | null) => {
        if (!live) return;
        setData(d);
        setState(d && d.peers.length ? "ready" : "none");
      })
      .catch(() => live && setState("none"));
    return () => {
      live = false;
    };
  }, [ticker]);

  const read = useMemo(() => (data ? readComps(inp, r, data.peers) : null), [data, inp, r]);

  if (!ticker || state === "idle") return null;

  return (
    <>
      <h2 className="section-h">How similar companies are priced</h2>
      <p className="section-p">
        A DCF values the business on its own cash flows. Comparable companies (comps) check that against how the market prices its peers
        today. Multiples are trailing twelve months.
      </p>
      {state === "loading" && <p className="muted" style={{ marginTop: 12 }}>Loading peers</p>}
      {state === "none" && (
        <p className="muted" style={{ marginTop: 12 }}>
          No US-listed peers with trading data were found for {ticker}.
        </p>
      )}
      {state === "ready" && data && read && (
        <>
          <div className="sens-wrap">
            <table className="comps">
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="num">Market cap</th>
                  <th className="num">EV / Sales</th>
                  <th className="num">EV / EBITDA</th>
                  <th className="num">P / E</th>
                </tr>
              </thead>
              <tbody>
                {data.self && (
                  <tr className="is-self">
                    <td>
                      <span className="co-ticker">{ticker}</span> {inp.company.name}
                    </td>
                    <td className="num">{data.self.marketCap ? moneyB(data.self.marketCap / 1e6) : "n/a"}</td>
                    <td className="num">{m(data.self.evSales)}</td>
                    <td className="num">{m(data.self.evEbitda)}</td>
                    <td className="num">{m(data.self.pe)}</td>
                  </tr>
                )}
                {data.peers.map((p) => (
                  <tr key={p.symbol}>
                    <td>
                      <span className="co-ticker">{p.symbol}</span> {p.name}
                    </td>
                    <td className="num">{p.marketCap ? moneyB(p.marketCap / 1e6) : "n/a"}</td>
                    <td className="num">{m(p.evSales)}</td>
                    <td className="num">{m(p.evEbitda)}</td>
                    <td className="num">{m(p.pe)}</td>
                  </tr>
                ))}
                <tr className="is-median">
                  <td>Peer median</td>
                  <td />
                  <td className="num">{m(read.medianEvSales)}</td>
                  <td className="num">{m(read.medianEvEbitda)}</td>
                  <td className="num">{m(read.medianPe)}</td>
                </tr>
                <tr className="is-model">
                  <td>Your DCF</td>
                  <td className="num">{r.equityValue > 0 ? moneyB(r.equityValue) : "n/a"}</td>
                  <td />
                  <td className="num">{m(read.modelEvEbitda)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: "var(--step--1)", marginTop: 8 }}>
            Peers and multiples from Financial Modeling Prep, refreshed daily. &ldquo;Your DCF&rdquo; is your enterprise value divided by{" "}
            {inp.company.baseYearLabel} EBITDA (EBIT plus D&amp;A).
          </p>

          {read.valueAtMedian !== null && read.medianEvEbitda !== null && (
            <div className="reverse" style={{ marginTop: 20 }}>
              <div>
                <div className="rv-cap">Value at the peer median EV/EBITDA</div>
                <div className="rv">{price(read.valueAtMedian)}</div>
                <p>
                  {mult(read.medianEvEbitda)} × {inp.company.baseYearLabel} EBITDA, minus debt, plus cash, divided by shares.{" "}
                  {signedPct(read.valueAtMedian / inp.sharePrice - 1, 0)} vs. today&rsquo;s {price(inp.sharePrice)}, and{" "}
                  {signedPct(read.valueAtMedian / r.impliedPrice - 1, 0)} vs. your DCF value of {price(r.impliedPrice)}.
                </p>
              </div>
              <div>
                <div className="rv-cap">What the gap means</div>
                <p style={{ marginTop: 6 }}>
                  {read.modelEvEbitda !== null && read.modelEvEbitda > read.medianEvEbitda * 1.25
                    ? "Your DCF values the company at a richer multiple than its peers trade at. That needs a reason: faster growth, higher margins or lower risk than the group."
                    : read.modelEvEbitda !== null && read.modelEvEbitda < read.medianEvEbitda * 0.8
                      ? "Your DCF values the company below where its peers trade. Either your assumptions are conservative, or the peers are expensive."
                      : "Your DCF lands close to where peers trade, so the two methods agree."}
                </p>
                {inp.terminalMethod === "exit" && Math.abs(inp.exitMultiple - read.medianEvEbitda) > 0.05 && (
                  <button
                    className="btn ghost small"
                    style={{ marginTop: 10 }}
                    onClick={() => update({ exitMultiple: Math.round(read.medianEvEbitda! * 10) / 10 }, ["exitMultiple"])}
                  >
                    Use {mult(read.medianEvEbitda)} as your exit multiple
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
