"use client";

import type { Ctx } from "./Valora";
import { Dot, Stars } from "./ui";
import { moneyB, pct, price, signedPct } from "@/lib/format";
import { STEP_FIELDS } from "./InputsStage";

export function LiveRead({ ctx, onIssue }: { ctx: Ctx; onIssue?: (step: number) => void }) {
  const { inputs, result, checks, stars, ready, missing } = ctx;

  if (!ready) {
    return (
      <aside className="live" aria-label="Live valuation">
        <div className="live-head">
          <div className="live-title">Live valuation</div>
          <div className="live-price faint">n/a</div>
        </div>
        <div className="live-sec">
          <div className="live-title">Fill these in to see a value:</div>
          {missing.map((m) => (
            <div key={m} className="issue">
              <Dot level={null} />
              <span>{m}</span>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  const issues = checks.filter((c) => c.level !== "good").sort((a, b) => (a.level === "bad" ? -1 : b.level === "bad" ? 1 : 0));
  const stepFor = (fields: string[]) => STEP_FIELDS.findIndex((fs) => fields.some((f) => fs.includes(f)));

  return (
    <aside className="live" aria-label="Live valuation">
      <div className="live-head">
        <div className="live-title">Implied value per share</div>
        <div className={`live-price ${result.impliedPrice < 0 ? "neg" : ""}`}>{price(result.impliedPrice)}</div>
        <div className="live-vs">
          {signedPct(result.upside)} vs. market price of {price(inputs.sharePrice)}
        </div>
      </div>
      <div className="live-sec">
        <div className="stars-line">
          <Stars value={stars} />
          <span className="stars-score">{stars.toFixed(1)} / 5</span>
        </div>
        <div className="live-title" style={{ marginTop: 4 }}>
          Model quality, from {checks.length} sanity checks
        </div>
        {issues.length === 0 ? (
          <p className="muted" style={{ fontSize: "var(--step--1)", marginTop: 8 }}>Every check is green.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {issues.slice(0, 4).map((c) => {
              const s = stepFor(c.fields);
              return (
                <div key={c.id} className="issue">
                  <Dot level={c.level} />
                  {onIssue && s >= 0 ? (
                    <button className="linkbtn" onClick={() => onIssue(s)}>{c.title}</button>
                  ) : (
                    <span>{c.title}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="live-sec">
        <div className="live-row"><span>Enterprise value</span><span className="num">{moneyB(result.enterpriseValue)}</span></div>
        <div className="live-row"><span>Equity value</span><span className="num">{moneyB(result.equityValue)}</span></div>
        <div className="live-row"><span>WACC</span><span className="num">{pct(result.wacc.wacc, 2)}</span></div>
        <div className="live-row"><span>Terminal value share of EV</span><span className="num">{pct(result.terminalShareOfEv, 0)}</span></div>
      </div>
    </aside>
  );
}
