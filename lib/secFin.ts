// Turns SEC company facts into excess return model inputs for banks,
// insurers, REITs and other financial companies. Pure, like lib/sec.ts.

import { MARKET } from "./companies";
import type { EquityInputs, EquityYear, FinKind } from "./equity";
export { KIND_LABEL } from "./equity";
import { FALLBACK_RF, rfNote, type RiskFree } from "./rates";
import {
  ADR_RATIOS, annual, currencyName, days, filingUrl, FIN, fiscalLabel, instant, latestKey, SecDataError, series, shares, tidyName,
  type Book, type CompanyFacts, type Fact, type Fx, type Taxonomy,
} from "./sec";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, step = 0.0025) => Number((Math.round(x / step) * step).toFixed(4));

/** Which taxonomy and currency the company reports net income in (latest annual wins). */
export function finBook(f: CompanyFacts): Book | null {
  let best: { book: Book; end: string; n: number } | null = null;
  for (const [tax, cs] of [["us-gaap", FIN.gaap.netIncome], ["ifrs-full", FIN.ifrs.netIncome]] as [Taxonomy, string[]][]) {
    for (const c of cs) {
      for (const [unit, facts] of Object.entries(f.facts[tax]?.[c]?.units ?? {})) {
        if (unit.includes("/")) continue;
        const y = annual(facts);
        if (!y.size) continue;
        const end = latestKey(y);
        if (!best || end > best.end || (end === best.end && y.size > best.n)) best = { book: { tax, unit, form: y.get(end)!.form ?? "10-K" }, end, n: y.size };
      }
    }
  }
  return best?.book ?? null;
}

/** First concept with a value at this date, in millions. */
function valueAt(f: CompanyFacts, cs: string[], date: string, kind: "annual" | "instant", book: Book): number | null {
  for (const c of cs) {
    const s = kind === "annual" ? annual(series(f, c, book)) : instant(series(f, c, book));
    const v = s.get(date)?.val;
    if (v !== undefined) return v / 1e6;
  }
  return null;
}

function kindOf(f: CompanyFacts, name: string): FinKind {
  const has = (cs: string[]) => cs.some((c) => f.facts["us-gaap"]?.[c] || f.facts["ifrs-full"]?.[c]);
  // Insurers and banks first: both often own real estate too
  if (has(FIN.markers.insurer) || /\b(insurance|assurance)\b/i.test(name)) return "insurer";
  if (has(FIN.markers.bank) || /\b(bank|bancorp|bancshares)\b/i.test(name)) return "bank";
  if (has(FIN.markers.reit) || /\b(reit|realty|properties)\b/i.test(name)) return "reit";
  return "financial";
}


export function equityFromFacts(
  f: CompanyFacts,
  ticker: string,
  rf: RiskFree = FALLBACK_RF,
  fx?: Fx | null,
): { inputs: EquityInputs; warnings: string[]; filingUrl: string } {
  const name = tidyName(f.entityName, ticker);
  const book = finBook(f);
  if (!book) throw new SecDataError(`${name} doesn't report net income in a standard way, so it can't be loaded automatically.`);
  if (book.unit !== "USD" && (!fx || fx.currency !== book.unit || !(fx.rate > 0))) {
    throw new SecDataError(`${name} reports in ${currencyName(book.unit)}, and today's exchange rate to US dollars isn't available. Try again in a minute.`);
  }
  const k = book.unit === "USD" ? 1 : fx!.rate;
  const C = book.tax === "ifrs-full" ? FIN.ifrs : FIN.gaap;
  const warnings: string[] = [];

  // Years where both net income and year-end equity are reported
  let niSeries: Map<string, Fact> | null = null;
  for (const c of C.netIncome) {
    const s = annual(series(f, c, book));
    if (s.size && (!niSeries || latestKey(s) > latestKey(niSeries))) niSeries = s;
  }
  const ends = [...(niSeries?.keys() ?? [])].sort().filter((d) => valueAt(f, C.equity, d, "instant", book) !== null).slice(-3);
  if (!ends.length) throw new SecDataError(`${name} doesn't report shareholders' equity in a standard way, so it can't be loaded automatically.`);
  const baseEnd = ends.at(-1)!;
  if (days(baseEnd, new Date().toISOString().slice(0, 10)) > 600) {
    warnings.push(`The latest annual numbers in the SEC's structured data are for the year ending ${baseEnd}. If there's a newer annual report, update the history from it.`);
  }

  const commonEquity = (d: string) => {
    const total = valueAt(f, C.equity, d, "instant", book) ?? 0;
    const pref = C.preferred.length ? valueAt(f, C.preferred, d, "instant", book) ?? 0 : 0;
    return (total - pref) * k;
  };
  const history: EquityYear[] = ends.map((d) => ({
    label: fiscalLabel(d),
    netIncome: (niSeries!.get(d)!.val / 1e6) * k,
    bookEquity: commonEquity(d),
    payouts: ((valueAt(f, C.dividends, d, "annual", book) ?? 0) + (valueAt(f, C.buybacks, d, "annual", book) ?? 0)) * k,
  }));
  const base = history.at(-1)!;
  const prevBook = history.length > 1 ? history.at(-2)!.bookEquity : base.bookEquity;
  const avgBook = (prevBook + base.bookEquity) / 2;
  const roe0 = avgBook > 0 ? base.netIncome / avgBook : 0;
  if (base.bookEquity <= 0) warnings.push("Common equity is zero or negative, so the excess return model can't value this company. Check the balance sheet.");

  // Share of earnings returned through dividends and buybacks, averaged over the years with profits
  const ratios = history.filter((h) => h.netIncome > 0).map((h) => h.payouts / h.netIncome);
  const avgPayout = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : NaN;
  const payoutRatio = Number.isFinite(avgPayout) ? round(clamp(avgPayout, 0, 1), 0.01) : 0.6;
  if (!history.some((h) => h.payouts > 0)) warnings.push("Dividends and buybacks weren't found, so the payout ratio starts at 60%. Check the cash flow statement.");

  // ROE fades from today's level toward a long-run level
  const start = round(clamp(roe0, -0.1, 0.35));
  const longRunRoe = round(clamp(Math.min(roe0, 0.12), 0.06, 0.12));
  const roe = [0, 1, 2, 3, 4].map((i) => round(start + ((longRunRoe - start) * i) / 4));
  const sustainable = longRunRoe * (1 - payoutRatio);
  const terminalGrowth = round(clamp(sustainable, 0.01, 0.03), 0.005);

  // Filings count ordinary shares; a US-listed ADR can stand for several
  const ratio = book.form !== "10-K" ? ADR_RATIOS[ticker.toUpperCase()] ?? 1 : 1;
  const sh = shares(f, baseEnd, book);
  if (!sh) warnings.push("Shares outstanding weren't found. Enter them from the cover of the annual report.");
  if (book.unit !== "USD") warnings.push(`${name} reports in ${currencyName(book.unit)}. Amounts were converted to US dollars at ${fx!.rate.toPrecision(4)} per ${book.unit} (${fx!.date}).`);

  const url = filingUrl(f.cik, niSeries!.get(baseEnd)!.accn);
  const filing = (note: string) => ({ kind: "filing" as const, note, url });
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const inputs: EquityInputs = {
    company: {
      name,
      ticker: ticker.toUpperCase(),
      baseYearLabel: base.label,
      priceDate: "",
      form: book.form,
      ...(book.unit !== "USD" ? { currency: book.unit } : {}),
      kind: kindOf(f, name),
    },
    history,
    bookEquity: base.bookEquity,
    roe,
    longRunRoe,
    payoutRatio,
    sharePrice: 0,
    sharesOutstanding: sh ? sh.value / ratio : 0,
    riskFreeRate: rf.rate,
    beta: 1,
    equityRiskPremium: MARKET.equityRiskPremium,
    terminalGrowth,
    sources: {
      history: filing(`${name} ${book.form} data from SEC EDGAR, fiscal years ${history[0].label} to ${base.label}. Equity excludes preferred stock.`),
      roe: { kind: "assumption", note: `Starts at last year's return on equity of ${pct(roe0)} (net income / average common equity) and fades toward the long-run level.` },
      longRunRoe: { kind: "assumption", note: "Capped at 12%. Competition usually pulls returns toward the cost of equity over time." },
      payoutRatio: Number.isFinite(avgPayout)
        ? filing(`Average of dividends plus buybacks / net income over the last ${ratios.length} profitable years: ${pct(avgPayout)}`)
        : { kind: "assumption", note: "Not found in the filing, so this starts at 60%." },
      sharesOutstanding: sh ? filing(sh.note) : { kind: "user" },
      sharePrice: { kind: "user", note: "Enter today's price. SEC filings don't include it." },
      riskFreeRate: { kind: "market", note: rfNote(rf) },
      beta: { kind: "assumption", note: "1.0 is the market average. Replaced with a beta from two years of prices when they load." },
      equityRiskPremium: { kind: "market", note: MARKET.erpNote, url: MARKET.erpUrl },
      terminalGrowth: { kind: "assumption", note: `Set near the growth the company can fund itself: long-run ROE × share of earnings kept = ${pct(sustainable)}, kept between 1% and 3%.` },
    },
  };
  return { inputs, warnings, filingUrl: url };
}
