"use client";

import type { OptCtx } from "./OptionsTool";
import { Dot, Stars } from "../ui";
import { pct, price } from "@/lib/format";

/** Sidebar with both prices, kept in view while editing. */
export function OptLive({ ctx }: { ctx: OptCtx }) {
  const { m, run, checks, stars } = ctx;
  const issues = checks.filter((c) => c.level !== "good");
  const card = (t: "call" | "put") => (
    <div className={`opt-mini ${m.type === t ? "is-sel" : ""}`}>
      <div className="live-title">{t === "call" ? "Call" : "Put"}</div>
      <div className="opt-mini-price">{run.valid ? price(t === "call" ? run.result.call : run.result.put) : "n/a"}</div>
    </div>
  );
  return (
    <aside className="live" aria-label="Live option prices">
      <div className="live-head">
        <div className="live-title">Black-Scholes value per share</div>
        <div className="opt-minis">
          {card("call")}
          {card("put")}
        </div>
        <div className="live-vs">One contract covers 100 shares: {price((run.price || 0) * 100)} for the {m.type}.</div>
      </div>
      <div className="live-sec">
        <div className="stars-line">
          <Stars value={stars} />
          <span className="stars-score">{stars.toFixed(1)} / 5</span>
        </div>
        <div className="live-title" style={{ marginTop: 4 }}>Input quality, from {checks.length} checks</div>
        <div style={{ marginTop: 8 }}>
          {issues.length === 0 ? (
            <p className="muted" style={{ fontSize: "var(--step--1)" }}>Every check is green.</p>
          ) : (
            issues.slice(0, 4).map((c) => (
              <div key={c.id} className="issue">
                <Dot level={c.level} />
                <span>{c.title}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="live-sec">
        <div className="live-row"><span>Days to expiration</span><span className="num">{run.days}</span></div>
        <div className="live-row"><span>Volatility</span><span className="num">{pct(m.sigma, 1)}</span></div>
        <div className="live-row"><span>Risk-free rate (continuous)</span><span className="num">{pct(run.r, 2)}</span></div>
        {run.impliedVol !== null && <div className="live-row"><span>Implied volatility</span><span className="num">{pct(run.impliedVol, 1)}</span></div>}
      </div>
    </aside>
  );
}
