// Turns SEC "company facts" (XBRL data from annual filings) into Valora inputs.
// US companies file 10-Ks under US GAAP. Foreign companies file 20-Fs (or
// 40-Fs from Canada), often under IFRS and in their home currency.
// Pure functions only, so it can be tested offline against saved fixtures.

import { MARKET } from "./companies";
import { FALLBACK_RF, rfNote, type RiskFree } from "./rates";
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

/** An exchange rate into US dollars: 1 unit of `currency` = `rate` USD. */
export interface Fx {
  currency: string;
  rate: number;
  date: string;
  source: string;
}

type Taxonomy = "us-gaap" | "ifrs-full";
/** Which accounting taxonomy and currency a company reports its annual numbers in. */
export interface Book {
  tax: Taxonomy;
  unit: string;
  form: string; // "10-K", "20-F" or "40-F"
}

const ANNUAL_FORMS = new Set(["10-K", "20-F", "40-F"]);

// How many ordinary shares one US-listed share (ADR) represents, for
// well-known foreign companies. Filings count ordinary shares; the share
// price is per ADR. Companies not listed here default to one for one.
export const ADR_RATIOS: Record<string, number> = {
  TSM: 5, BABA: 8, BIDU: 8, PDD: 4, JD: 2, NTES: 5, HDB: 3, IBN: 2, INFY: 1, WIT: 1,
  BP: 6, SHEL: 2, AZN: 0.5, GSK: 2, DEO: 4, SNY: 0.5, TM: 10, HMC: 3, SONY: 1, NVO: 1, ASML: 1, ARM: 1,
  SAP: 1, UL: 1, NVS: 1, RIO: 1, BHP: 2, TTE: 1, BTI: 1, NGG: 5, VOD: 10, MUFG: 1, SMFG: 5,
};

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
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
};

// The same ideas under IFRS. Some are summed rather than picked (see `sumAt`).
const I = {
  revenue: ["Revenue", "RevenueFromContractsWithCustomers"],
  ebit: ["ProfitLossFromOperatingActivities"],
  da: [
    "DepreciationAndAmortisationExpense",
    "DepreciationAmortisationAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
    "AdjustmentsForDepreciationAndAmortisationExpense",
    "AdjustmentsForDepreciationAndAmortisationExpenseAndImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
  ],
  daParts: ["DepreciationExpense", "AmortisationExpense"],
  capex: ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "PurchaseOfPropertyPlantAndEquipment"],
  tax: ["IncomeTaxExpenseContinuingOperations"],
  pretax: ["ProfitLossBeforeTax"],
  cash: ["CashAndCashEquivalents"],
  secCurrentParts: [
    "CurrentFinancialAssetsAtAmortisedCost",
    "CurrentFinancialAssetsAtFairValueThroughOtherComprehensiveIncome",
    "CurrentFinancialAssetsAtFairValueThroughProfitOrLoss",
  ],
  assetsCurrent: ["CurrentAssets"],
  liabCurrent: ["CurrentLiabilities"],
  debtTotal: ["Borrowings"],
  debtCurrentTotal: ["CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings"],
  debtCurrentParts: ["CurrentBondsIssuedAndCurrentPortionOfNoncurrentBondsIssued", "CurrentPortionOfLongtermBorrowings", "ShorttermBorrowings"],
  debtNoncurrentParts: ["NoncurrentPortionOfNoncurrentBondsIssued", "LongtermBorrowings"],
  shares: ["NumberOfSharesOutstanding"],
  netIncome: ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
};

const USD_BOOK: Book = { tax: "us-gaap", unit: "USD", form: "10-K" };

function series(f: CompanyFacts, concept: string, book: Book = USD_BOOK): Fact[] {
  return f.facts[book.tax]?.[concept]?.units?.[book.unit] ?? [];
}

/** Annual (roughly 12 month) values from annual reports, keyed by period end, latest filing wins. */
function annual(facts: Fact[]): Map<string, Fact> {
  const out = new Map<string, Fact>();
  for (const e of facts) {
    if (!ANNUAL_FORMS.has(e.form ?? "") || !e.start) continue;
    const d = days(e.start, e.end);
    if (d < 340 || d > 380) continue;
    const prev = out.get(e.end);
    if (!prev || e.filed > prev.filed) out.set(e.end, e);
  }
  return out;
}

/** Point-in-time balance sheet values from annual reports, keyed by date. */
function instant(facts: Fact[]): Map<string, Fact> {
  const out = new Map<string, Fact>();
  for (const e of facts) {
    if (!ANNUAL_FORMS.has(e.form ?? "") || e.start) continue;
    const prev = out.get(e.end);
    if (!prev || e.filed > prev.filed) out.set(e.end, e);
  }
  return out;
}

function latestKey(m: Map<string, Fact>): string {
  return [...m.keys()].sort().at(-1) ?? "";
}

/** Pick the candidate concept with the most recent data. */
function pick(f: CompanyFacts, candidates: string[], kind: "annual" | "instant", book: Book = USD_BOOK) {
  let best: { concept: string; series: Map<string, Fact> } | null = null;
  for (const c of candidates) {
    const s = kind === "annual" ? annual(series(f, c, book)) : instant(series(f, c, book));
    if (s.size === 0) continue;
    if (!best || latestKey(s) > latestKey(best.series)) best = { concept: c, series: s };
  }
  return best;
}

/** Value at a given date, in millions of the book's currency; null if not reported at that date. */
function at(f: CompanyFacts, candidates: string[], date: string, kind: "annual" | "instant", book: Book = USD_BOOK): number | null {
  // Most recently updated concept first, then the next, until one has this date.
  const all = candidates
    .map((c) => (kind === "annual" ? annual(series(f, c, book)) : instant(series(f, c, book))))
    .filter((s) => s.size > 0)
    .sort((a, b) => (latestKey(b) > latestKey(a) ? 1 : latestKey(b) < latestKey(a) ? -1 : 0));
  for (const s of all) {
    const v = s.get(date)?.val;
    if (v !== undefined) return v / 1e6;
  }
  return null;
}

/** Sum of several separate line items at a date; null if none is reported. */
function sumAt(f: CompanyFacts, parts: string[], date: string, kind: "annual" | "instant", book: Book): number | null {
  const vals = parts.map((c) => at(f, [c], date, kind, book)).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

/**
 * Find how a company reports: US GAAP or IFRS, which currency, and which
 * annual form. The pairing with the most recent annual revenue wins; ties go
 * to the one with the longest history (TSMC also tags a few USD translations).
 */
export function reportingBook(f: CompanyFacts): Book | null {
  let best: { book: Book; end: string; n: number } | null = null;
  const revenue: [Taxonomy, string[]][] = [["us-gaap", C.revenue], ["ifrs-full", I.revenue]];
  for (const [tax, concepts] of revenue) {
    for (const c of concepts) {
      for (const [unit, facts] of Object.entries(f.facts[tax]?.[c]?.units ?? {})) {
        if (unit.includes("/")) continue;
        const yearly = annual(facts);
        if (!yearly.size) continue;
        const end = latestKey(yearly);
        const form = yearly.get(end)!.form ?? "10-K";
        if (!best || end > best.end || (end === best.end && yearly.size > best.n)) best = { book: { tax, unit, form }, end, n: yearly.size };
      }
    }
  }
  return best?.book ?? null;
}

const CURRENCY_NAMES: Record<string, string> = {
  EUR: "euros", GBP: "British pounds", JPY: "Japanese yen", TWD: "Taiwan dollars", DKK: "Danish kroner", CHF: "Swiss francs",
  CNY: "Chinese yuan", RMB: "Chinese yuan", INR: "Indian rupees", CAD: "Canadian dollars", AUD: "Australian dollars",
  KRW: "Korean won", SEK: "Swedish kronor", NOK: "Norwegian kroner", BRL: "Brazilian reais", MXN: "Mexican pesos", HKD: "Hong Kong dollars",
};
export const currencyName = (c: string) => CURRENCY_NAMES[c] ?? c;

export function fiscalLabel(end: string): string {
  const d = new Date(end + "T00:00:00Z");
  // A year that ends in the first week of January is named for the prior year.
  const y = d.getUTCMonth() === 0 && d.getUTCDate() <= 7 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  return `FY${y}`;
}

export function filingUrl(cik: number, accn: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, "")}/`;
}

function shares(f: CompanyFacts, baseEnd: string, book: Book): { value: number; note: string } | null {
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
  if (book.tax === "ifrs-full") {
    const n = instant(f.facts["ifrs-full"]?.NumberOfSharesOutstanding?.units?.shares ?? []).get(baseEnd);
    if (n) return { value: n.val / 1e6, note: `Shares outstanding at ${baseEnd}, from the annual report` };
  }
  const cso = instant(f.facts["us-gaap"]?.CommonStockSharesOutstanding?.units?.shares ?? []).get(baseEnd);
  if (cso) return { value: cso.val / 1e6, note: `Shares outstanding at ${baseEnd}, from the balance sheet` };
  const wad = annual(f.facts["us-gaap"]?.WeightedAverageNumberOfDilutedSharesOutstanding?.units?.shares ?? []).get(baseEnd);
  if (wad) return { value: wad.val / 1e6, note: `Diluted weighted average shares for the year. Swap in the current count if you have it` };
  return null;
}

/** "MICROSOFT CORP" -> "Microsoft Corp". Mixed-case names are left alone. */
export function tidyName(raw: string, ticker = ""): string {
  // SEC names sometimes end in filing tags like " /NEW", " /DE/" or " \DE\".
  // A space comes before the tag, which keeps names like "Novo Nordisk A/S" whole.
  const tag = /\s+[\\/][A-Za-z]{1,4}[\\/]?\s*$/;
  const n = raw.replace(tag, "").replace(tag, "").trim();
  if (n !== n.toUpperCase()) return n;
  const tick = ticker.toUpperCase().replace(/-.*/, "");
  const keep = new Set(["INC", "LLC", "PLC", "NV", "SA", "AG", "LP", "CO", "&"]);
  return n
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      const bare = w.replace(/[.,]/g, "").toUpperCase();
      if (tick && bare === tick) return w.toUpperCase(); // "ASML Holding NV", not "Asml"
      if (/^[A-Z]\/[A-Z]$/.test(bare)) return w.toUpperCase(); // "A/S"
      if (bare === "INC" || bare === "CO" || bare === "CORP") return w.charAt(0).toUpperCase() + w.slice(1);
      if (keep.has(bare) && bare.length <= 3 && bare !== "CO") return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, step = 0.005) => Number((Math.round(x / step) * step).toFixed(4));

export function inputsFromFacts(f: CompanyFacts, ticker: string, rf: RiskFree = FALLBACK_RF, fx?: Fx | null): LoadResult {
  const warnings: string[] = [];
  const book = reportingBook(f);
  if (!book) throw new SecDataError(`${tidyName(f.entityName, ticker)} doesn't report revenue in a standard way, so it can't be loaded automatically.`);
  const ifrs = book.tax === "ifrs-full";
  const K = ifrs ? I : C;
  const form = book.form;
  const foreign = form !== "10-K";
  if (book.unit !== "USD" && (!fx || fx.currency !== book.unit || !(fx.rate > 0))) {
    throw new SecDataError(`${tidyName(f.entityName, ticker)} reports in ${currencyName(book.unit)}, and today's exchange rate to US dollars isn't available. Try again in a minute.`);
  }
  // Every amount is converted to US dollars, so it lines up with the US share price.
  const k = book.unit === "USD" ? 1 : fx!.rate;
  const val = (f2: CompanyFacts, cands: string[], date: string, kind: "annual" | "instant") => {
    const v = at(f2, cands, date, kind, book);
    return v === null ? null : v * k;
  };
  const sum = (parts: string[], date: string, kind: "annual" | "instant") => {
    const v = sumAt(f, parts, date, kind, book);
    return v === null ? null : v * k;
  };

  const rev = pick(f, K.revenue, "annual", book);
  const ebitSeries = pick(f, K.ebit, "annual", book);
  if (!rev) throw new SecDataError(`${tidyName(f.entityName, ticker)} doesn't report revenue in a standard way, so it can't be loaded automatically.`);
  if (!ebitSeries || !ebitSeries.series.has(latestKey(rev.series))) {
    throw new SecDataError(
      `${tidyName(f.entityName, ticker)} doesn't report operating income. That's normal for banks and insurers, which are valued with different models than a standard DCF. Try an operating company instead.`,
    );
  }

  const ends = [...rev.series.keys()].sort().slice(-3);
  const baseEnd = ends.at(-1)!;
  if (days(baseEnd, new Date().toISOString().slice(0, 10)) > 600) {
    warnings.push(`The latest annual numbers in the SEC's structured data are for the year ending ${baseEnd}. If the company has filed a newer ${form}, update the history and balance sheet from it.`);
  }
  const baseFact = rev.series.get(baseEnd)!;
  const url = filingUrl(f.cik, baseFact.accn);

  const daOf = (end: string) => val(f, K.da, end, "annual") ?? (ifrs ? sum(I.daParts, end, "annual") : null);
  const history: HistoricalYear[] = ends.map((end) => ({
    label: fiscalLabel(end),
    revenue: (rev.series.get(end)!.val / 1e6) * k,
    ebit: val(f, K.ebit, end, "annual") ?? 0,
    da: daOf(end) ?? 0,
    capex: val(f, K.capex, end, "annual") ?? 0,
  }));
  const base = history.at(-1)!;
  if (!base.da) warnings.push("D&A wasn't found in the filing data. Enter it from the cash flow statement.");
  const daConcept = pick(f, K.da, "annual", book)?.concept;
  if (base.da && daConcept === "Depreciation") {
    warnings.push("This company only reports depreciation in the standard data, so amortization may be missing from D&A. Check the cash flow statement and adjust it in step 1 if needed.");
  }
  if (!base.capex) warnings.push("Capex wasn't found in the filing data. Enter it from the cash flow statement.");

  // Balance sheet at base year end
  const cash = val(f, K.cash, baseEnd, "instant") ?? 0;
  let secCur = 0, secNon = 0, debt = 0, debtCurrent = 0;
  if (ifrs) {
    secCur = sum(I.secCurrentParts, baseEnd, "instant") ?? 0;
    const cur = val(f, I.debtCurrentTotal, baseEnd, "instant") ?? sum(I.debtCurrentParts, baseEnd, "instant");
    const non = sum(I.debtNoncurrentParts, baseEnd, "instant");
    const total = val(f, I.debtTotal, baseEnd, "instant");
    debtCurrent = cur ?? 0;
    if (total !== null) debt = total;
    else if (cur !== null || non !== null) debt = (cur ?? 0) + (non ?? 0);
    else warnings.push("Total debt wasn't found. Check the balance sheet and enter it in the Balance sheet step.");
  } else {
    secCur = val(f, C.secCurrent, baseEnd, "instant") ?? 0;
    secNon = val(f, C.secNoncurrent, baseEnd, "instant") ?? 0;
    const debtNon = val(f, C.debtNoncurrent, baseEnd, "instant");
    const debtCurTotal = val(f, C.debtCurrentTotal, baseEnd, "instant");
    const ltdCur = val(f, C.ltdCurrent, baseEnd, "instant") ?? 0;
    const cp = val(f, C.commercialPaper, baseEnd, "instant") ?? 0;
    const stb = val(f, C.shortTermBorrowings, baseEnd, "instant") ?? 0;
    debtCurrent = debtCurTotal ?? ltdCur + cp + stb;
    if (debtNon !== null) {
      debt = debtNon + debtCurrent;
    } else {
      const ltd = val(f, C.ltdTotal, baseEnd, "instant");
      debt = (ltd ?? 0) + cp + stb;
      debtCurrent = ltdCur + cp + stb;
      if (ltd === null) warnings.push("Total debt wasn't found. Check the balance sheet and enter it in the Balance sheet step.");
    }
  }

  const ca = val(f, K.assetsCurrent, baseEnd, "instant");
  const cl = val(f, K.liabCurrent, baseEnd, "instant");
  let baseNwc = 0;
  if (ca !== null && cl !== null) {
    baseNwc = ca - cash - secCur - (cl - debtCurrent);
  } else {
    warnings.push("Current assets or liabilities weren't found, so working capital starts at zero. Enter it in the Taxes and reinvestment step.");
  }

  // Filings count ordinary shares. A US-listed ADR can stand for several.
  const sym = ticker.toUpperCase();
  const ratio = foreign ? ADR_RATIOS[sym] ?? 1 : 1;
  const rawShares = shares(f, baseEnd, book);
  const sh = rawShares && ratio !== 1
    ? { value: rawShares.value / ratio, note: `${rawShares.note}, divided by ${ratio} because one US-listed share (ADR) represents ${ratio} ordinary shares` }
    : rawShares;
  if (!sh) warnings.push(`Shares outstanding weren't found. Enter them from the cover of the ${form}.`);
  if (foreign && sh && !(sym in ADR_RATIOS)) {
    warnings.push(`${tidyName(f.entityName, ticker)} files a ${form}. The share count assumes one US-listed share equals one ordinary share. If its ADR represents more or fewer shares, adjust the count in the Balance sheet step.`);
  }
  if (book.unit !== "USD") {
    warnings.push(`${tidyName(f.entityName, ticker)} reports in ${currencyName(book.unit)}. Every amount was converted to US dollars at ${fx!.rate.toPrecision(4)} per ${book.unit} (${fx!.date}), so margins and growth rates are unchanged.`);
  }

  // Tax rate from the base year, if it's sensible
  const tax = val(f, K.tax, baseEnd, "annual");
  const pretax = val(f, K.pretax, baseEnd, "annual");
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
  const name = tidyName(f.entityName, ticker);
  const sources: Record<string, Source> = {
    history: filing(
      `${name} ${form} data from SEC EDGAR, fiscal years ${history[0].label} to ${base.label}` +
        (book.unit !== "USD" ? `, converted from ${currencyName(book.unit)} at ${fx!.rate.toPrecision(4)} USD per ${book.unit} (${fx!.source}, ${fx!.date})` : ""),
    ),
    baseNwc: filing("Current assets minus cash and securities, less current liabilities excluding debt"),
    revenueGrowth: { kind: "assumption", note: `Starts at the recent average of ${(avgGrowth * 100).toFixed(1)}% (capped between -5% and 25%) and fades toward 4%. A starting point, not a forecast.` },
    ebitMargin: { kind: "assumption", note: `Held at the base year margin of ${(baseMargin * 100).toFixed(1)}%.` },
    taxRate: isFinite(effTax) && taxRate === effTax
      ? filing(`Base year effective rate: income tax / pre-tax income = ${(effTax * 100).toFixed(1)}%`)
      : { kind: "assumption", note: foreign ? "The reported rate looked unusual, so this uses 21%. Check the company's home-country rate." : "The reported rate looked unusual, so this uses the 21% US federal rate." },
    daPct: filing(`Base year D&A of ${Math.round(base.da).toLocaleString("en-US")} is ${(daPct * 100).toFixed(1)}% of revenue`),
    capexPct: { kind: "assumption", note: `Average capex over the last ${history.length} years was ${(capexAvg * 100).toFixed(1)}% of revenue.` },
    nwcPct: filing(`Base year working capital is ${(nwcPct * 100).toFixed(1)}% of revenue`),
    sharePrice: { kind: "user", note: "Enter today's price. SEC filings don't include it." },
    sharesOutstanding: sh ? filing(sh.note) : { kind: "user" },
    cash: filing(`Cash ${Math.round(cash).toLocaleString("en-US")} + current securities ${Math.round(secCur).toLocaleString("en-US")} + long-term securities ${Math.round(secNon).toLocaleString("en-US")}`),
    debt: filing(`Total borrowings at ${baseEnd}. Leases are not included.`),
    riskFreeRate: { kind: "market", note: rfNote(rf) },
    beta: { kind: "assumption", note: "1.0 is the market average. Look up this company's beta and replace it." },
    equityRiskPremium: { kind: "market", note: MARKET.erpNote, url: MARKET.erpUrl },
    preTaxCostOfDebt: { kind: "assumption", note: "Risk-free rate plus 1.5 points. Riskier borrowers pay more." },
    terminalGrowth: { kind: "assumption", note: "Roughly long-run inflation plus modest real growth." },
    exitMultiple: { kind: "assumption", note: "Only used if you switch to the exit multiple method." },
  };

  const inputs: DcfInputs = {
    company: { name, ticker: ticker.toUpperCase(), baseYearLabel: base.label, priceDate: "", form, ...(book.unit !== "USD" ? { currency: book.unit } : {}) },
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
    riskFreeRate: rf.rate,
    beta: 1.0,
    equityRiskPremium: MARKET.equityRiskPremium,
    preTaxCostOfDebt: Math.round((rf.rate + 0.015) * 10000) / 10000,
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
  const keepGaap = new Set([...Object.values(C).flat(), "CommonStockSharesOutstanding", "WeightedAverageNumberOfDilutedSharesOutstanding", ...DPS.gaap]);
  const keepIfrs = new Set([...Object.values(I).flat(), ...DPS.ifrs]);
  const slim = (units: Record<string, Fact[]>) =>
    Object.fromEntries(
      Object.entries(units).map(([u, xs]) => [
        u,
        xs.filter((e) => e.end >= since && (ANNUAL_FORMS.has(e.form ?? "") || e.form === "10-Q"))
          .map(({ start, end, val, accn, form, filed }) => ({ start, end, val, accn, form, filed })),
      ]),
    );
  const keepOnly = (tax: Taxonomy, keep: Set<string>) =>
    Object.fromEntries(
      Object.entries(f.facts[tax] ?? {})
        .filter(([k]) => keep.has(k))
        .map(([k, v]) => [k, { units: slim(v.units) }]),
    );
  const dei: Record<string, { units: Record<string, Fact[]> }> = {};
  if (f.facts.dei?.EntityCommonStockSharesOutstanding) {
    dei.EntityCommonStockSharesOutstanding = { units: slim(f.facts.dei.EntityCommonStockSharesOutstanding.units) };
  }
  const facts: CompanyFacts["facts"] = { "us-gaap": keepOnly("us-gaap", keepGaap), dei };
  if (f.facts["ifrs-full"]) facts["ifrs-full"] = keepOnly("ifrs-full", keepIfrs);
  return { cik: f.cik, entityName: f.entityName, facts };
}

const DPS = {
  gaap: ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
  ifrs: ["DividendsRecognisedAsDistributionsToOwnersPerShare", "DividendsPaidOrdinarySharesPerShare"],
};

/**
 * Dividends per US-listed share over the most recent fiscal year, in US dollars.
 * Foreign companies' per-share dividends are converted with `fx` and scaled
 * up by the ADR ratio. Returns null when none is reported (or none is paid).
 */
export function dividendInfo(f: CompanyFacts, ticker = "", fx?: Fx | null): { dps: number; year: string } | null {
  const book = reportingBook(f) ?? USD_BOOK;
  if (book.unit !== "USD" && (!fx || fx.currency !== book.unit)) return null;
  const k = book.unit === "USD" ? 1 : fx!.rate;
  const ratio = book.form !== "10-K" ? ADR_RATIOS[ticker.toUpperCase()] ?? 1 : 1;
  const concepts = book.tax === "ifrs-full" ? DPS.ifrs : DPS.gaap;
  let best: { dps: number; year: string; end: string } | null = null;
  for (const c of concepts) {
    const facts = f.facts[book.tax]?.[c]?.units?.[`${book.unit}/shares`] ?? [];
    const yearly = annual(facts);
    const end = latestKey(yearly);
    if (end && (!best || end > best.end)) best = { dps: yearly.get(end)!.val * k * ratio, year: fiscalLabel(end), end };
  }
  if (!best || !(best.dps > 0)) return null;
  // Foreign companies file their annual report later in the year, so allow more time.
  const age = days(best.end, new Date().toISOString().slice(0, 10));
  return age > (book.form === "10-K" ? 550 : 800) ? null : { dps: best.dps, year: best.year };
}

/** Net income for the latest fiscal year, in $ millions (converted with `fx` for foreign reporters). */
export function netIncomeFromFacts(f: CompanyFacts, fx?: Fx | null): number | null {
  const book = reportingBook(f);
  if (!book) return null;
  if (book.unit !== "USD" && (!fx || fx.currency !== book.unit)) return null;
  const k = book.unit === "USD" ? 1 : fx!.rate;
  const rev = pick(f, (book.tax === "ifrs-full" ? I : C).revenue, "annual", book);
  if (!rev) return null;
  const v = at(f, (book.tax === "ifrs-full" ? I : C).netIncome, latestKey(rev.series), "annual", book);
  return v === null ? null : v * k;
}
