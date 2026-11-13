// Sanity checks for the excess return model, in the same style as the DCF's.
import type { Check, Level } from "./checks";
import type { EquityInputs, EquityResult } from "./equity";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export function equityChecks(i: EquityInputs, r: EquityResult): Check[] {
  const c: Check[] = [];
  const add = (id: string, title: string, level: Level, message: string, fields: string[]) => c.push({ id, title, level, message, fields });
  const ke = r.costOfEquity;
  const base = i.history.at(-1);
  const roe0 = i.roe[0];

  add("roe", "Return on equity", roe0 < 0 ? "bad" : roe0 > 0.25 || roe0 < 0.04 ? "warn" : "good",
    roe0 < 0 ? `The first forecast year loses money (${pct(roe0)} ROE). Excess returns are deeply negative until that turns around.`
      : roe0 > 0.25 ? `${pct(roe0)} is unusually high for a financial company. Large banks usually earn 10% to 18%.`
      : roe0 < 0.04 ? `${pct(roe0)} is low. Check whether last year had one-time losses, or whether this is a REIT, whose depreciation keeps reported ROE low.`
      : `${pct(roe0)} in the first year, in the normal range for a financial company.`, ["roe"]);

  const spread = i.longRunRoe - ke;
  add("spread", "Long-run ROE vs. cost of equity", spread > 0.05 ? "warn" : spread < -0.04 ? "warn" : "good",
    spread > 0.05 ? `Earning ${pct(spread)} above the cost of equity forever assumes a lasting edge. Competition usually narrows that gap.`
      : spread < -0.04 ? `Earning ${pct(-spread)} below the cost of equity forever means the company destroys value on every dollar it keeps. That can be right for a struggling firm, but it's a strong call.`
      : `Long-run ROE of ${pct(i.longRunRoe)} against a ${pct(ke)} cost of equity. ${spread >= 0 ? "Worth a bit more than book value over time." : "Worth a bit less than book value over time."}`, ["longRunRoe"]);

  add("ke", "Cost of equity", ke >= 0.07 && ke <= 0.14 ? "good" : ke >= 0.05 && ke <= 0.18 ? "warn" : "bad",
    ke >= 0.07 && ke <= 0.14 ? `${pct(ke, 2)} is in the usual range for a large financial company.` : `${pct(ke, 2)} is outside the usual 7% to 14% range. Check beta and the risk premium.`, ["beta", "riskFreeRate", "equityRiskPremium"]);

  add("beta", "Beta", i.beta >= 0.6 && i.beta <= 1.8 ? "good" : "warn",
    i.beta >= 0.6 && i.beta <= 1.8 ? `${i.beta.toFixed(2)} is a typical beta for a financial stock.` : `${i.beta.toFixed(2)} is unusual for a financial stock, which usually runs between 0.8 and 1.5.`, ["beta"]);

  if (!r.terminal.valid) {
    add("g", "Terminal growth", "bad", "Terminal growth has to be below the cost of equity, or the terminal value is infinite.", ["terminalGrowth"]);
  } else {
    const sg = r.sustainableGrowth;
    add("g", "Terminal growth", i.terminalGrowth > 0.04 ? "warn" : i.terminalGrowth > sg + 0.01 ? "warn" : "good",
      i.terminalGrowth > 0.04 ? `${pct(i.terminalGrowth)} forever is faster than the economy usually grows.`
        : i.terminalGrowth > sg + 0.01 ? `Growing ${pct(i.terminalGrowth)} a year needs more capital than the company keeps. At ${pct(i.longRunRoe)} ROE and a ${pct(i.payoutRatio, 0)} payout, it can fund about ${pct(sg)} a year.`
        : `${pct(i.terminalGrowth)} a year, which the company can fund from the earnings it keeps (about ${pct(sg)}).`, ["terminalGrowth", "payoutRatio"]);
  }

  add("payout", "Payout ratio", i.payoutRatio > 1 ? "warn" : i.payoutRatio < 0 ? "bad" : "good",
    i.payoutRatio > 1 ? "Paying out more than 100% of earnings shrinks book equity every year. Fine for a while, not forever." : `Returns ${pct(i.payoutRatio, 0)} of earnings through dividends and buybacks and keeps the rest.`, ["payoutRatio"]);

  if (Number.isFinite(r.terminalShare)) {
    const ts = r.terminalShare;
    add("tv", "Terminal value share", Math.abs(ts) > 0.6 ? "warn" : "good",
      Math.abs(ts) > 0.6 ? `The terminal value is ${pct(ts, 0)} of the total. Most of the answer depends on the long-run ROE.` : `The terminal value is ${pct(ts, 0)} of the total. Book value carries most of the weight, which is typical for this model.`, ["longRunRoe", "terminalGrowth"]);
  }

  if (base && base.bookEquity <= 0) add("book", "Book equity", "bad", "Book equity is zero or negative, so this model doesn't apply.", ["history"]);

  if (i.sharePrice > 0 && Number.isFinite(r.upside)) {
    const gap = Math.abs(r.upside);
    add("gap", "Gap to market price", gap > 0.5 ? "warn" : "good",
      gap > 0.5 ? `Your value is ${pct(gap, 0)} ${r.upside < 0 ? "below" : "above"} the market price. Check "What the market is pricing in" to see the long-run ROE today's price implies.` : `Within ${pct(Math.max(gap, 0.001), 0)} of the market price.`, ["longRunRoe"]);
  }
  return c;
}
