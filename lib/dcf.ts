import type { DcfInputs, DcfResult, ProjectedYear, WaccBuild } from "./types";

export const PROJECTION_YEARS = 5;

export function baseYear(inputs: DcfInputs) {
  return inputs.history[inputs.history.length - 1];
}

/** "FY2026" -> ["FY2027", ... "FY2031"]. Falls back to "Year 1" etc. */
export function projectionLabels(baseLabel: string): string[] {
  const m = baseLabel.match(/^(.*?)(\d{4})$/);
  return Array.from({ length: PROJECTION_YEARS }, (_, i) =>
    m ? `${m[1]}${Number(m[2]) + i + 1}` : `Year ${i + 1}`,
  );
}

export function computeWacc(inputs: DcfInputs): WaccBuild {
  const marketCap = inputs.sharePrice * inputs.sharesOutstanding;
  const debt = Math.max(0, inputs.debt);
  const total = marketCap + debt;
  const equityWeight = total > 0 ? marketCap / total : 1;
  const debtWeight = total > 0 ? debt / total : 0;
  const costOfEquity = inputs.riskFreeRate + inputs.beta * inputs.equityRiskPremium;
  const afterTaxCostOfDebt = inputs.preTaxCostOfDebt * (1 - inputs.taxRate);
  const wacc = equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt;
  return { marketCap, debt, equityWeight, debtWeight, costOfEquity, afterTaxCostOfDebt, wacc };
}

/**
 * Run the full DCF. `waccOverride` and the terminal overrides exist so the
 * sensitivity tables and the reverse DCF can reuse the same math.
 */
export function runDcf(
  inputs: DcfInputs,
  overrides: { wacc?: number; terminalGrowth?: number; exitMultiple?: number } = {},
): DcfResult {
  const waccBuild = computeWacc(inputs);
  const wacc = overrides.wacc ?? waccBuild.wacc;
  const g = overrides.terminalGrowth ?? inputs.terminalGrowth;
  const multiple = overrides.exitMultiple ?? inputs.exitMultiple;
  const base = baseYear(inputs);
  const labels = projectionLabels(inputs.company.baseYearLabel);

  const years: ProjectedYear[] = [];
  let prevRevenue = base.revenue;
  let prevNwc = inputs.baseNwc;

  for (let i = 0; i < PROJECTION_YEARS; i++) {
    const growth = inputs.revenueGrowth[i] ?? 0;
    const margin = inputs.ebitMargin[i] ?? 0;
    const revenue = prevRevenue * (1 + growth);
    const ebit = revenue * margin;
    const taxes = ebit * inputs.taxRate;
    const nopat = ebit - taxes;
    const da = revenue * inputs.daPct;
    const capex = revenue * inputs.capexPct;
    const nwc = revenue * inputs.nwcPct;
    const changeInNwc = nwc - prevNwc;
    const ufcf = nopat + da - capex - changeInNwc;
    const period = inputs.midYear ? i + 0.5 : i + 1;
    const discountFactor = 1 / Math.pow(1 + wacc, period);
    years.push({
      label: labels[i],
      revenue,
      growth,
      ebit,
      margin,
      taxes,
      nopat,
      da,
      capex,
      nwc,
      changeInNwc,
      ufcf,
      ebitda: ebit + da,
      period,
      discountFactor,
      pvUfcf: ufcf * discountFactor,
    });
    prevRevenue = revenue;
    prevNwc = nwc;
  }

  const last = years[years.length - 1];
  // Terminal value sits at the end of year 5 under both conventions.
  const tvDiscountFactor = 1 / Math.pow(1 + wacc, PROJECTION_YEARS);
  let tv: number;
  let valid = true;
  if (inputs.terminalMethod === "gordon") {
    valid = wacc > g;
    tv = valid ? (last.ufcf * (1 + g)) / (wacc - g) : NaN;
  } else {
    tv = last.ebitda * multiple;
  }
  const impliedExitMultiple = tv / last.ebitda;
  // Solve TV = FCF * (1 + g) / (WACC - g) for g.
  const impliedGrowth = (tv * wacc - last.ufcf) / (tv + last.ufcf);
  const pvTv = tv * tvDiscountFactor;

  const sumPvUfcf = years.reduce((s, y) => s + y.pvUfcf, 0);
  const enterpriseValue = sumPvUfcf + pvTv;
  const equityValue = enterpriseValue - inputs.debt + inputs.cash;
  const impliedPrice = inputs.sharesOutstanding > 0 ? equityValue / inputs.sharesOutstanding : NaN;
  const upside = inputs.sharePrice > 0 ? impliedPrice / inputs.sharePrice - 1 : NaN;

  return {
    years,
    wacc: { ...waccBuild, wacc },
    terminal: {
      method: inputs.terminalMethod,
      value: tv,
      pv: pvTv,
      discountFactor: tvDiscountFactor,
      impliedExitMultiple,
      impliedGrowth,
      valid,
    },
    sumPvUfcf,
    enterpriseValue,
    equityValue,
    impliedPrice,
    upside,
    terminalShareOfEv: pvTv / enterpriseValue,
  };
}

/** Grid of implied share prices. Rows vary WACC, columns vary the terminal input. */
export function sensitivity(
  inputs: DcfInputs,
  waccSteps: number[],
  terminalSteps: number[],
): { waccs: number[]; terminals: number[]; prices: number[][] } {
  const baseWacc = computeWacc(inputs).wacc;
  const baseTerminal =
    inputs.terminalMethod === "gordon" ? inputs.terminalGrowth : inputs.exitMultiple;
  const waccs = waccSteps.map((d) => baseWacc + d);
  const terminals = terminalSteps.map((d) => baseTerminal + d);
  const prices = waccs.map((w) =>
    terminals.map((t) => {
      const r =
        inputs.terminalMethod === "gordon"
          ? runDcf(inputs, { wacc: w, terminalGrowth: t })
          : runDcf(inputs, { wacc: w, exitMultiple: t });
      return r.terminal.valid ? r.impliedPrice : NaN;
    }),
  );
  return { waccs, terminals, prices };
}

/** Bisection on a function that is monotonic over [lo, hi]. */
function solve(f: (x: number) => number, lo: number, hi: number): number | null {
  let flo = f(lo);
  const fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (!isFinite(fm)) return null;
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Reverse DCF: what would you have to believe for the model to land on
 * today's share price? Holds everything else constant.
 */
export function reverseDcf(inputs: DcfInputs): {
  wacc: number | null;
  terminalGrowth: number | null;
  exitMultiple: number | null;
} {
  const target = inputs.sharePrice;
  const g = inputs.terminalGrowth;
  const gap = (r: DcfResult) => r.impliedPrice - target;

  let wacc: number | null = null;
  if (inputs.terminalMethod === "gordon") {
    wacc = solve((w) => gap(runDcf(inputs, { wacc: w })), g + 0.0005, 0.4);
  } else {
    wacc = solve((w) => gap(runDcf(inputs, { wacc: w })), 0.005, 0.4);
  }

  let terminalGrowth: number | null = null;
  let exitMultiple: number | null = null;
  if (inputs.terminalMethod === "gordon") {
    const w = computeWacc(inputs).wacc;
    terminalGrowth = solve((x) => gap(runDcf(inputs, { terminalGrowth: x })), -0.1, w - 0.0005);
  } else {
    exitMultiple = solve((x) => gap(runDcf(inputs, { exitMultiple: x })), 0, 200);
  }
  return { wacc, terminalGrowth, exitMultiple };
}
