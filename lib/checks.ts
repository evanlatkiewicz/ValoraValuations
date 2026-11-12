import { baseYear } from "./dcf";
import type { DcfInputs, DcfResult } from "./types";

export type Level = "good" | "warn" | "bad";

export interface Check {
  id: string;
  title: string;
  level: Level;
  message: string;
  fields: string[]; // input ids this check is attached to
}

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

function band(
  x: number,
  good: [number, number],
  warn: [number, number],
): Level {
  if (x >= good[0] && x <= good[1]) return "good";
  if (x >= warn[0] && x <= warn[1]) return "warn";
  return "bad";
}

export function runChecks(inputs: DcfInputs, r: DcfResult): Check[] {
  const checks: Check[] = [];
  const w = r.wacc.wacc;
  const g = inputs.terminalGrowth;
  const hist = inputs.history;
  const base = baseYear(inputs);

  // Terminal growth
  if (inputs.terminalMethod === "gordon") {
    let level: Level;
    let message: string;
    if (g >= w) {
      level = "bad";
      message = `Terminal growth (${pct(g)}) is at or above WACC (${pct(w)}). The perpetuity formula divides by WACC minus growth, so the value blows up. Growth has to be below WACC.`;
    } else if (g < 0) {
      level = "warn";
      message = `A negative terminal growth rate says the business shrinks forever. That fits a declining industry, not most companies.`;
    } else if (g <= 0.03) {
      level = "good";
      message = `${pct(g)} forever is in line with long-run inflation plus a little real growth.`;
    } else if (g <= 0.04) {
      level = "warn";
      message = `${pct(g)} is on the high side. No company can outgrow the economy forever, and long-run nominal GDP growth is usually put around 3% to 4%.`;
    } else {
      level = "bad";
      message = `${pct(g)} forever means this company eventually becomes bigger than the economy. Most analysts stay at or below 3%.`;
    }
    checks.push({ id: "tgr", title: "Terminal growth rate", level, message, fields: ["terminalGrowth"] });

    const m = r.terminal.impliedExitMultiple;
    const lm = m > 0 ? band(m, [5, 20], [3, 30]) : "bad";
    checks.push({
      id: "implied-multiple",
      title: "Implied exit multiple",
      level: r.terminal.valid ? lm : "bad",
      message: r.terminal.valid && m <= 0
        ? `The terminal value is negative because year 5 free cash flow is negative, so there's no meaningful multiple.`
        : r.terminal.valid
        ? `Your terminal value works out to ${m.toFixed(1)}x final-year EBITDA. ${
            lm === "good"
              ? "That is a reasonable multiple for a mature business."
              : "Compare that to what similar companies actually trade at. If it looks far off, revisit your growth rate or WACC."
          }`
        : "Can't compute because terminal growth is not below WACC.",
      fields: ["terminalGrowth"],
    });
  } else {
    const m = inputs.exitMultiple;
    checks.push({
      id: "exit-multiple",
      title: "Exit multiple",
      level: band(m, [5, 20], [3, 30]),
      message: `${m.toFixed(1)}x EBITDA. Check this against where comparable companies trade today, not where the market was at its peak.`,
      fields: ["exitMultiple"],
    });
    const ig = r.terminal.impliedGrowth;
    const lg: Level = ig <= 0.035 && ig >= -0.01 ? "good" : ig <= 0.05 ? "warn" : "bad";
    checks.push({
      id: "implied-growth",
      title: "Implied perpetual growth",
      level: lg,
      message: `Your exit multiple implies the cash flows grow ${pct(ig)} per year forever. ${
        lg === "good" ? "That is believable." : "That is hard to defend for any company over the very long run."
      }`,
      fields: ["exitMultiple"],
    });
  }

  // Free cash flow sign. A DCF needs positive cash flow by the final year,
  // or the terminal value assumes losses forever.
  const fcf = r.years.map((y) => y.ufcf);
  const lastFcf = fcf[fcf.length - 1];
  const negYears = fcf.filter((x) => x <= 0).length;
  if (lastFcf <= 0) {
    checks.push({
      id: "fcf",
      title: "Free cash flow",
      level: "bad",
      message:
        inputs.terminalMethod === "gordon"
          ? `Free cash flow is still negative in year 5, so the terminal value assumes the company burns cash forever. That makes the valuation meaningless. Raise the operating margin, lower capex toward D&A, or add growth so the business generates cash by year 5.`
          : `Free cash flow is still negative in year 5. The exit multiple can mask that, but a business that never generates cash isn't worth much. Check margins and capex.`,
      fields: ["ebitMargin", "capexPct", "revenueGrowth"],
    });
  } else if (negYears > 0) {
    checks.push({
      id: "fcf",
      title: "Free cash flow",
      level: "warn",
      message: `Free cash flow is negative in ${negYears} of the 5 years before turning positive. That's normal for a company investing heavily, but the value now leans even more on the terminal value.`,
      fields: ["ebitMargin", "capexPct"],
    });
  } else {
    checks.push({
      id: "fcf",
      title: "Free cash flow",
      level: "good",
      message: "Free cash flow is positive in every projected year.",
      fields: [],
    });
  }
  if (r.enterpriseValue <= 0) {
    checks.push({
      id: "ev",
      title: "Enterprise value",
      level: "bad",
      message: `The model gives a negative enterprise value, which means the operating business destroys value under these assumptions. Any value per share is coming from the cash on the balance sheet, not from the business.`,
      fields: ["ebitMargin", "capexPct"],
    });
  }

  // Heavy reinvestment with no growth
  const avgGrowth = inputs.revenueGrowth.reduce((a, b) => a + b, 0) / inputs.revenueGrowth.length;
  if (avgGrowth < 0.02 && inputs.capexPct > inputs.daPct * 1.5) {
    checks.push({
      id: "capex-growth",
      title: "Capex vs. growth",
      level: "warn",
      message: `Capex is ${(inputs.capexPct / Math.max(inputs.daPct, 1e-9)).toFixed(1)}x D&A while revenue barely grows. Companies spend well above D&A to grow. If you expect little growth, capex near D&A is more consistent. If you expect the spending to pay off, add the growth.`,
      fields: ["capexPct", "revenueGrowth"],
    });
  }

  // WACC
  const lw = band(w, [0.06, 0.12], [0.045, 0.16]);
  checks.push({
    id: "wacc",
    title: "Discount rate (WACC)",
    level: lw,
    message:
      lw === "good"
        ? `${pct(w)} is in the normal range for a large US company.`
        : w < 0.06
          ? `${pct(w)} is low. A low discount rate makes future cash flows worth a lot more today, so double-check beta and the equity risk premium.`
          : `${pct(w)} is high for a public company. That fits a small or risky business, but it will push the value down a lot.`,
    fields: ["riskFreeRate", "beta", "equityRiskPremium", "preTaxCostOfDebt"],
  });

  // Beta
  const lb = band(inputs.beta, [0.6, 1.8], [0.3, 2.5]);
  checks.push({
    id: "beta",
    title: "Beta",
    level: lb,
    message:
      lb === "good"
        ? `A beta of ${inputs.beta.toFixed(2)} is within the usual range.`
        : `A beta of ${inputs.beta.toFixed(2)} is unusual. Most large companies sit between about 0.6 and 1.8.`,
    fields: ["beta"],
  });

  // ERP
  const le = band(inputs.equityRiskPremium, [0.035, 0.065], [0.025, 0.08]);
  checks.push({
    id: "erp",
    title: "Equity risk premium",
    level: le,
    message:
      le === "good"
        ? `${pct(inputs.equityRiskPremium)} is within the range most practitioners use.`
        : `${pct(inputs.equityRiskPremium)} is outside the typical 3.5% to 6.5% range for the US market.`,
    fields: ["equityRiskPremium"],
  });

  // Risk-free rate
  checks.push({
    id: "rf",
    title: "Risk-free rate",
    level: band(inputs.riskFreeRate, [0.01, 0.065], [0, 0.09]),
    message: `Use the current 10-year Treasury yield. You entered ${pct(inputs.riskFreeRate, 2)}.`,
    fields: ["riskFreeRate"],
  });

  // Cost of debt
  if (inputs.debt > 0) {
    const ok = inputs.preTaxCostOfDebt >= inputs.riskFreeRate;
    checks.push({
      id: "kd",
      title: "Cost of debt",
      level: ok ? "good" : "warn",
      message: ok
        ? `${pct(inputs.preTaxCostOfDebt)} pre-tax is above the risk-free rate, as it should be.`
        : `A company can't usually borrow below the government. Set the cost of debt at or above the risk-free rate.`,
      fields: ["preTaxCostOfDebt"],
    });
  }

  // Tax rate
  const lt = band(inputs.taxRate, [0.12, 0.28], [0.05, 0.35]);
  checks.push({
    id: "tax",
    title: "Tax rate",
    level: lt,
    message:
      lt === "good"
        ? `${pct(inputs.taxRate)} is a normal effective rate for a US company.`
        : `${pct(inputs.taxRate)} is unusual. The US federal rate is 21% before state and foreign taxes.`,
    fields: ["taxRate"],
  });

  // Revenue growth path
  const growth = inputs.revenueGrowth;
  const maxG = Math.max(...growth);
  const lastHistGrowth =
    hist.length >= 2 ? hist[hist.length - 1].revenue / hist[hist.length - 2].revenue - 1 : null;
  let lg: Level = band(maxG, [-0.1, 0.25], [-0.3, 0.4]);
  let gm = `Your fastest year is ${pct(maxG)} growth.`;
  if (lastHistGrowth !== null && growth[0] - lastHistGrowth > 0.1) {
    lg = growth[0] - lastHistGrowth > 0.25 ? "bad" : lg === "good" ? "warn" : lg;
    gm += ` Year 1 growth of ${pct(growth[0])} is well above last year's actual ${pct(lastHistGrowth)}. What changes to make it speed up?`;
  } else if (lg === "good") {
    gm += " That is a believable path.";
  } else {
    gm += " Very few companies sustain that, especially large ones.";
  }
  checks.push({ id: "growth", title: "Revenue growth", level: lg, message: gm, fields: ["revenueGrowth"] });

  // Fade into terminal
  if (inputs.terminalMethod === "gordon") {
    const cliff = growth[growth.length - 1] - g;
    const lc: Level = cliff <= 0.05 ? "good" : cliff <= 0.1 ? "warn" : "bad";
    checks.push({
      id: "fade",
      title: "Growth fade",
      level: lc,
      message:
        lc === "good"
          ? `Growth slows from ${pct(growth[growth.length - 1])} in the last projected year to ${pct(g)} forever. A smooth landing.`
          : `Growth drops from ${pct(growth[growth.length - 1])} straight to ${pct(g)} forever. Fade it down more over the five years, or the terminal year is not a steady state.`,
      fields: ["revenueGrowth", "terminalGrowth"],
    });
  }

  // Margin path
  const baseMargin = base.revenue > 0 ? base.ebit / base.revenue : 0;
  const finalMargin = inputs.ebitMargin[inputs.ebitMargin.length - 1];
  const expansion = finalMargin - baseMargin;
  const lmg: Level = finalMargin > 0.6 ? "bad" : expansion > 0.12 ? "bad" : expansion > 0.05 ? "warn" : "good";
  checks.push({
    id: "margin",
    title: "Operating margin",
    level: lmg,
    message:
      lmg === "good"
        ? `Margins go from ${pct(baseMargin)} today to ${pct(finalMargin)} in year 5. That is close to what the business does now.`
        : `Margins expand from ${pct(baseMargin)} to ${pct(finalMargin)}. That needs a clear reason, like pricing power or scale benefits.`,
    fields: ["ebitMargin"],
  });

  // Reinvestment
  const capexToDa = inputs.daPct > 0 ? inputs.capexPct / inputs.daPct : 1;
  const growingForever = inputs.terminalMethod === "gordon" ? g > 0 : true;
  const lr: Level = inputs.capexPct < 0 ? "bad" : growingForever && capexToDa < 0.85 ? "warn" : "good";
  checks.push({
    id: "reinvest",
    title: "Reinvestment",
    level: lr,
    message:
      lr === "good"
        ? `Capex is ${capexToDa.toFixed(2)}x D&A, so the company is maintaining or growing its asset base.`
        : `Capex is below D&A, which means the asset base shrinks over time. That doesn't fit a company you expect to keep growing.`,
    fields: ["capexPct", "daPct"],
  });

  // Terminal value share
  const share = r.terminalShareOfEv;
  const ls: Level = !isFinite(share) ? "bad" : share <= 0.8 ? "good" : share <= 0.88 ? "warn" : "bad";
  checks.push({
    id: "tv-share",
    title: "Terminal value weight",
    level: ls,
    message: isFinite(share)
      ? `${pct(share, 0)} of enterprise value comes from the terminal value. ${
          ls === "good"
            ? "Normal for a mature company."
            : "Most of your answer rests on one assumption about the distant future, so test it in the sensitivity table."
        }`
      : "Can't compute.",
    fields: ["terminalGrowth", "exitMultiple"],
  });

  // Gap to market (informational, never worse than a warning)
  if (isFinite(r.upside)) {
    const a = Math.abs(r.upside);
    checks.push({
      id: "gap",
      title: "Gap to market price",
      level: a <= 0.4 ? "good" : "warn",
      message:
        a <= 0.4
          ? `Your value is ${pct(a, 0)} ${r.upside < 0 ? "below" : "above"} the market price, a gap that reasonable changes in assumptions could close.`
          : `Your value is ${pct(a, 0)} ${r.upside < 0 ? "below" : "above"} the market price. That can be a real view, but first check "What the market is pricing in" to see which assumptions would close the gap.`,
      fields: [],
    });
  }

  return checks;
}

/** 5 stars minus 1 per red and 0.5 per yellow, floored at 1, in half steps. */
export function starRating(checks: Check[]): number {
  const bad = checks.filter((c) => c.level === "bad").length;
  const warn = checks.filter((c) => c.level === "warn").length;
  const raw = 5 - bad - 0.5 * warn;
  return Math.max(1, Math.round(raw * 2) / 2);
}

export function worstLevelFor(checks: Check[], field: string): Level | null {
  const rel = checks.filter((c) => c.fields.includes(field));
  if (rel.length === 0) return null;
  if (rel.some((c) => c.level === "bad")) return "bad";
  if (rel.some((c) => c.level === "warn")) return "warn";
  return "good";
}
