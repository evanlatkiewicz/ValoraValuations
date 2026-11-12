// Turns SEC "company facts" (XBRL data from 10-K filings) into Valora inputs.
// Pure functions only, so it can be tested offline against saved fixtures.

import { MARKET } from "./companies";
import type { DcfInputs, HistoricalYear, Source } from "./types";

interface Fact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed: string;
}

export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, { units: Record<string, Fact[]> }>>;
}

export interface LoadResult {
  inputs: DcfInputs;
  warnings: string[];
  filingUrl: string;
}

export class SecDataError extends Error {}

const DAY = 86400000;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DAY;

// Concept candidates in priority order. When several have data, the one with
// the most recent fiscal year wins (companies switch tags over time).
const C = {
  revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  ebit: ["OperatingIncomeLoss"],
  da: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
    "DepreciationAndAmortization",
    "Depreciation",
  ],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  tax: ["IncomeTaxExpenseBenefit"],
  pretax: [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
  ],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  secCurrent: ["MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent", "ShortTermInvestments"],
  secNoncurrent: ["MarketableSecuritiesNoncurrent", "AvailableForSaleSecuritiesDebtSecuritiesNoncurrent"],
  assetsCurrent: ["AssetsCurrent"],
  liabCurrent: ["LiabilitiesCurrent"],
  debtNoncurrent: ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
  debtCurrentTotal: ["DebtCurrent"],
  ltdCurrent: ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
  commercialPaper: ["CommercialPaper"],
  shortTermBorrowings: ["ShortTermBorrowings"],
  ltdTotal: ["LongTermDebt"],
};

function usd(f: CompanyFacts, concept: string): Fact[] {
  return f.facts["us-gaap"]?.[concept]?.units?.USD ?? [];
}

/** Annual (roughly 12 month) values from 10-K filings, keyed by period end, latest filing wins. */
function annual(facts: Fact[]): Map<string, Fact> {
  const out = new Map<string, Fact>();
  for (const e of facts) {
    if (e.form !== "10-K" || !e.start) continue;
    const d = days(e.start, e.end);
    if (d < 340 || d > 380) continue;
    const prev = out.get(e.end);
    if (!prev || e.filed > prev.filed) out.set(e.end, e);
  }
  return out;
}

/** Point-in-time balance sheet values from 10-K filings, keyed by date. */
function instant(facts: Fact[]): Map<string, Fact> {
  const out = new Map<string, Fact>();
  for (const e of facts) {
    if (e.form !== "10-K" || e.start) continue;
    const prev = out.get(e.end);
    if (!prev || e.filed > prev.filed) out.set(e.end, e);
  }
  return out;
}

function latestKey(m: Map<string, Fact>): string {
  return [...m.keys()].sort().at(-1) ?? "";
}

/** Pick the candidate concept with the most recent data. */
function pick(f: CompanyFacts, candidates: string[], kind: "annual" | "instant") {
  let best: { concept: string; series: Map<string, Fact> } | null = null;
  for (const c of candidates) {
    const s = kind === "annual" ? annual(usd(f, c)) : instant(usd(f, c));
    if (s.size === 0) continue;
    if (!best || latestKey(s) > latestKey(best.series)) best = { concept: c, series: s };
  }
  return best;
}

/** Value at a given date, in $ millions; 0 if not reported at that date. */
function at(f: CompanyFacts, candidates: string[], date: string, kind: "annual" | "instant"): number | null {
  // Most recently updated concept first, then the next, until one has this date.
  const series = candidates
    .map((c) => (kind === "annual" ? annual(usd(f, c)) : instant(usd(f, c))))
    .filter((s) => s.size > 0)
    .sort((a, b) => (latestKey(b) > latestKey(a) ? 1 : latestKey(b) < latestKey(a) ? -1 : 0));
  for (const s of series) {
    const v = s.get(date)?.val;
    if (v !== undefined) return v / 1e6;
  }
  return null;
}

export function fiscalLabel(end: string): string {
  const d = new Date(end + "T00:00:00Z");
  // A year that ends in the first week of January is named for the prior year.
  const y = d.getUTCMonth() === 0 && d.getUTCDate() <= 7 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  return `FY${y}`;
}

export function filingUrl(cik: number, accn: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, "")}/`;
}

function shares(f: CompanyFacts, baseEnd: string): { value: number; note: string } | null {
  // Cover-page share count is the most current. Only use it if it's recent.
  const dei = f.facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [];
  if (dei.length) {
    const lastEnd = dei.map((e) => e.end).sort().at(-1)!;
    if (days(baseEnd, lastEnd) > -30) {
      const sameDate = dei.filter((e) => e.end === lastEnd);
      const accn = sameDate.map((e) => e.accn).sort().at(-1);
      const vals = new Set(sameDate.filter((e) => e.accn === accn).map((e) => e.val));
      const total = [...vals].reduce((a, b) => a + b, 0);
      return { value: total / 1e6, note: `Shares outstanding as of ${lastEnd}, from the cover of the latest filing` };
    }
  }
  const cso = instant(f.facts["us-gaap"]?.CommonStockSharesOutstanding?.units?.shares ?? []).get(baseEnd);
  if (cso) return { value: cso.val / 1e6, note: `Shares outstanding at ${baseEnd}, from the balance sheet` };
  const wad = annual(f.facts["us-gaap"]?.WeightedAverageNumberOfDilutedSharesOutstanding?.units?.shares ?? []).get(baseEnd);
  if (wad) return { value: wad.val / 1e6, note: `Diluted weighted average shares for the year. Swap in the current count if you have it` };
  return null;
}

/** "MICROSOFT CORP" -> "Microsoft Corp". Mixed-case names are left alone. */
export function tidyName(n: string): string {
  if (n !== n.toUpperCase()) return n;
  const keep = new Set(["INC", "LLC", "PLC", "NV", "SA", "AG", "LP", "CO", "&"]);
  return n
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[.,]/g, "").toUpperCase();
      if (bare === "INC" || bare === "CO" || bare === "CORP") return w.charAt(0).toUpperCase() + w.slice(1);
      if (keep.has(bare) && bare.length <= 3 && bare !== "CO") return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, step = 0.005) => Number((Math.round(x / step) * step).toFixed(4));

export function inputsFromFacts(f: CompanyFacts, ticker: string): LoadResult {
  const warnings: string[] = [];
  const rev = pick(f, C.revenue, "annual");
  const ebitSeries = pick(f, C.ebit, "annual");
  if (!rev) throw new SecDataError(`${f.entityName} doesn't report revenue in a standard way, so it can't be loaded automatically.`);
  if (!ebitSeries || !ebitSeries.series.has(latestKey(rev.series))) {
    throw new SecDataError(
      `${f.entityName} doesn't report operating income. That's normal for banks and insurers, which are valued with different models than a standard DCF. Try an operating company instead.`,
    );
  }

  const ends = [...rev.series.keys()].sort().slice(-3);
  const baseEnd = ends.at(-1)!;
  if (days(baseEnd, new Date().toISOString().slice(0, 10)) > 600) {
    warnings.push(`The latest annual data is for the year ending ${baseEnd}. The company may have stopped filing or changed how it reports.`);
  }
  const baseFact = rev.series.get(baseEnd)!;
  const url = filingUrl(f.cik, baseFact.accn);

  const history: HistoricalYear[] = ends.map((end) => ({
    label: fiscalLabel(end),
    revenue: rev.series.get(end)!.val / 1e6,
    ebit: at(f, C.ebit, end, "annual") ?? 0,
    da: at(f, C.da, end, "annual") ?? 0,
    capex: at(f, C.capex, end, "annual") ?? 0,
  }));
  const base = history.at(-1)!;
  if (!base.da) warnings.push("D&A wasn't found in the filing data. Enter it from the cash flow statement.");
  if (!base.capex) warnings.push("Capex wasn't found in the filing data. Enter it from the cash flow statement.");

  // Balance sheet at base year end
  const cash = at(f, C.cash, baseEnd, "instant") ?? 0;
  const secCur = at(f, C.secCurrent, baseEnd, "instant") ?? 0;
  const secNon = at(f, C.secNoncurrent, baseEnd, "instant") ?? 0;
  const debtNon = at(f, C.debtNoncurrent, baseEnd, "instant");
  const debtCurTotal = at(f, C.debtCurrentTotal, baseEnd, "instant");
  const ltdCur = at(f, C.ltdCurrent, baseEnd, "instant") ?? 0;
  const cp = at(f, C.commercialPaper, baseEnd, "instant") ?? 0;
  const stb = at(f, C.shortTermBorrowings, baseEnd, "instant") ?? 0;
  let debtCurrent = debtCurTotal ?? ltdCur + cp + stb;
  let debt: number;
  if (debtNon !== null) {
    debt = debtNon + debtCurrent;
  } else {
    const ltd = at(f, C.ltdTotal, baseEnd, "instant");
    debt = (ltd ?? 0) + cp + stb;
    debtCurrent = ltdCur + cp + stb;
    if (ltd === null) warnings.push("Total debt wasn't found. Check the balance sheet and enter it in the Balance sheet step.");
  }

  const ca = at(f, C.assetsCurrent, baseEnd, "instant");
  const cl = at(f, C.liabCurrent, baseEnd, "instant");
  let baseNwc = 0;
  if (ca !== null && cl !== null) {
    baseNwc = ca - cash - secCur - (cl - debtCurrent);
  } else {
    warnings.push("Current assets or liabilities weren't found, so working capital starts at zero. Enter it in the Taxes and reinvestment step.");
  }

  const sh = shares(f, baseEnd);
  if (!sh) warnings.push("Shares outstanding weren't found. Enter them from the cover of the 10-K.");

  // Tax rate from the base year, if it's sensible
  const tax = at(f, C.tax, baseEnd, "annual");
  const pretax = at(f, C.pretax, baseEnd, "annual");
  const effTax = tax !== null && pretax && pretax > 0 ? tax / pretax : NaN;
  const taxRate = isFinite(effTax) && effTax > 0.05 && effTax < 0.4 ? effTax : 0.21;

  // Starting assumptions: recent growth fading toward a long-run rate,
  // margins held at the base year. Clearly tagged as assumptions to revisit.
  const growths = history.slice(1).map((y, i) => y.revenue / history[i].revenue - 1);
  const avgGrowth = growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : 0.05;
  const g1 = round(clamp(avgGrowth, -0.05, 0.25));
  const g5 = round(Math.min(g1, 0.04));
  const revenueGrowth = [0, 1, 2, 3, 4].map((i) => round(g1 + ((g5 - g1) * i) / 4, 0.0025));
  const baseMargin = base.revenue > 0 ? base.ebit / base.revenue : 0.1;
  const margin = round(clamp(baseMargin, -0.2, 0.6), 0.0025);
  const daPct = base.revenue > 0 ? round(base.da / base.revenue, 0.001) : 0.03;
  const capexAvg = history.reduce((s, y) => s + (y.revenue > 0 ? y.capex / y.revenue : 0), 0) / history.length;
  const capexPct = round(capexAvg, 0.001);
  const nwcPct = base.revenue > 0 ? round(baseNwc / base.revenue, 0.001) : 0;

  const filing = (note: string): Source => ({ kind: "filing", note, url });
  const name = tidyName(f.entityName);
  const sources: Record<string, Source> = {
    history: filing(`${name} 10-K data from SEC EDGAR, fiscal years ${history[0].label} to ${base.label}`),
    baseNwc: filing("Current assets minus cash and securities, less current liabilities excluding debt"),
    revenueGrowth: { kind: "assumption", note: `Starts at the recent average of ${(avgGrowth * 100).toFixed(1)}% (capped between -5% and 25%) and fades toward 4%. A starting point, not a forecast.` },
    ebitMargin: { kind: "assumption", note: `Held at the base year margin of ${(baseMargin * 100).toFixed(1)}%.` },
    taxRate: isFinite(effTax) && taxRate === effTax
      ? filing(`Base year effective rate: income tax / pre-tax income = ${(effTax * 100).toFixed(1)}%`)
      : { kind: "assumption", note: "The reported rate looked unusual, so this uses the 21% US federal rate." },
    daPct: filing(`Base year D&A of ${Math.round(base.da).toLocaleString("en-US")} is ${(daPct * 100).toFixed(1)}% of revenue`),
    capexPct: { kind: "assumption", note: `Average capex over the last ${history.length} years was ${(capexAvg * 100).toFixed(1)}% of revenue.` },
    nwcPct: filing(`Base year working capital is ${(nwcPct * 100).toFixed(1)}% of revenue`),
    sharePrice: { kind: "user", note: "Enter today's price. SEC filings don't include it." },
    sharesOutstanding: sh ? filing(sh.note) : { kind: "user" },
    cash: filing(`Cash ${Math.round(cash).toLocaleString("en-US")} + current securities ${Math.round(secCur).toLocaleString("en-US")} + long-term securities ${Math.round(secNon).toLocaleString("en-US")}`),
    debt: filing(`Total borrowings at ${baseEnd}. Leases are not included.`),
    riskFreeRate: { kind: "market", note: MARKET.riskFreeNote },
    beta: { kind: "assumption", note: "1.0 is the market average. Look up this company's beta and replace it." },
    equityRiskPremium: { kind: "market", note: MARKET.erpNote, url: MARKET.erpUrl },
    preTaxCostOfDebt: { kind: "assumption", note: "Risk-free rate plus 1.5 points. Riskier borrowers pay more." },
    terminalGrowth: { kind: "assumption", note: "Roughly long-run inflation plus modest real growth." },
    exitMultiple: { kind: "assumption", note: "Only used if you switch to the exit multiple method." },
  };

  const inputs: DcfInputs = {
    company: { name, ticker: ticker.toUpperCase(), baseYearLabel: base.label, priceDate: "" },
    history,
    baseNwc,
    revenueGrowth,
    ebitMargin: [margin, margin, margin, margin, margin],
    taxRate: Math.round(taxRate * 1000) / 1000,
    daPct,
    capexPct,
    nwcPct,
    sharePrice: 0,
    sharesOutstanding: sh?.value ?? 0,
    cash: cash + secCur + secNon,
    debt,
    riskFreeRate: MARKET.riskFreeRate,
    beta: 1.0,
    equityRiskPremium: MARKET.equityRiskPremium,
    preTaxCostOfDebt: Math.round((MARKET.riskFreeRate + 0.015) * 1000) / 1000,
    terminalMethod: "gordon",
    terminalGrowth: 0.025,
    exitMultiple: 12,
    midYear: false,
    sources,
  };
  return { inputs, warnings, filingUrl: url };
}

/** Keep only the concepts Valora uses, so fixtures and responses stay small. */
export function trimFacts(f: CompanyFacts, since = "2019-01-01"): CompanyFacts {
  const keep = new Set([...Object.values(C).flat(), "CommonStockSharesOutstanding", "WeightedAverageNumberOfDilutedSharesOutstanding"]);
  const slim = (units: Record<string, Fact[]>) =>
    Object.fromEntries(
      Object.entries(units).map(([u, xs]) => [
        u,
        xs.filter((e) => e.end >= since && (e.form === "10-K" || e.form === "10-Q"))
          .map(({ start, end, val, accn, form, filed }) => ({ start, end, val, accn, form, filed })),
      ]),
    );
  const gaap = Object.fromEntries(
    Object.entries(f.facts["us-gaap"] ?? {})
      .filter(([k]) => keep.has(k))
      .map(([k, v]) => [k, { units: slim(v.units) }]),
  );
  const dei: Record<string, { units: Record<string, Fact[]> }> = {};
  if (f.facts.dei?.EntityCommonStockSharesOutstanding) {
    dei.EntityCommonStockSharesOutstanding = { units: slim(f.facts.dei.EntityCommonStockSharesOutstanding.units) };
  }
  return { cik: f.cik, entityName: f.entityName, facts: { "us-gaap": gaap, dei } };
}
