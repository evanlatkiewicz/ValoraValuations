// Gathers everything the one-page company snapshot shows into plain numbers.
// Pure: the page fetches peers, earnings, dividends and rates, then calls this.

import { analyze, caseInputs } from "./scenarios";
import { reverseDcf, runDcf } from "./dcf";
import { runChecks, starRating } from "./checks";
import { readComps, type PeerRow } from "./comps";
import { yieldAt, type Curve } from "./curve";
import { blackScholes, historicalVol } from "./options";
import { continuousRate, daysBetween, expiryIn, roundStrike } from "./optionModel";
import type { MarketData } from "./market";
import type { DcfInputs } from "./types";

export interface SnapshotSources {
  model: DcfInputs; // the whole model, with any saved cases
  market: MarketData | null;
  curve: Curve | null;
  tenYear: number | null;
  peers: { peers: PeerRow[]; selfNetIncome: number | null } | null;
  earnings: { date: string; epsEstimated: number | null } | null;
  dps: number | null;
  today: string; // YYYY-MM-DD
}

export interface TrendRow {
  label: string;
  projected: boolean;
  revenue: number; // $ millions
  growth: number | null;
  margin: number;
  fcf: number;
}

export interface SnapshotData {
  today: string;
  company: { name: string; ticker: string; baseYear: string; form: string; currency: string | null };
  quote: {
    price: number;
    priceDate: string;
    change: number | null;
    changePct: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    avgVolume: number | null;
    high52: number | null;
    low52: number | null;
    marketCap: number; // $
    pe: number | null;
    divYield: number | null;
    beta: number;
    nextEarnings: string | null;
  };
  chart: { d: string; c: number }[];
  yearReturn: number | null;
  trends: TrendRow[];
  valuation: {
    value: number;
    upside: number;
    wacc: number;
    method: "gordon" | "exit";
    terminal: number; // growth rate or exit multiple
    tvShare: number;
    stars: number;
    greenChecks: number;
    totalChecks: number;
    cases: { bear: number; base: number; bull: number; weighted: number; weights: [number, number, number] } | null;
    reverseWacc: number | null;
    warn: boolean;
  };
  peers: { rows: PeerRow[]; medianEvEbitda: number | null; medianPe: number | null; valueAtMedian: number | null; selfEvEbitda: number | null } | null;
  options: {
    expiry: string;
    days: number;
    strike: number;
    call: number;
    put: number;
    vol: number;
    rate: number;
    expectedMove: number;
    earningsBefore: boolean;
  } | null;
  issues: { title: string; message: string; level: "warn" | "bad" }[];
}

export function buildSnapshot(src: SnapshotSources): SnapshotData {
  const base = caseInputs(src.model, "base");
  const r = runDcf(base);
  const checks = runChecks(base, r);
  const a = analyze(src.model);
  const q = src.market?.quote;
  const price = q && Number.isFinite(q.close) && q.close > 0 ? q.close : base.sharePrice;
  const priceDate = q?.date ?? base.company.priceDate ?? src.today;
  const mcap = price * base.sharesOutstanding; // $ millions
  const ni = src.peers?.selfNetIncome ?? null;

  // Trends: three reported years, then the five the model projects
  const tax = base.taxRate;
  const trends: TrendRow[] = [
    ...base.history.map((h, i) => ({
      label: h.label,
      projected: false,
      revenue: h.revenue,
      growth: i > 0 && base.history[i - 1].revenue > 0 ? h.revenue / base.history[i - 1].revenue - 1 : null,
      margin: h.revenue > 0 ? h.ebit / h.revenue : 0,
      fcf: h.ebit * (1 - tax) + h.da - h.capex, // before working capital, which filings don't break out cleanly
    })),
    ...r.years.map((y) => ({ label: y.label, projected: true, revenue: y.revenue, growth: y.growth, margin: y.margin, fcf: y.ufcf })),
  ];

  const bars = src.market?.bars ?? [];
  const chart = bars.slice(-252);
  const yearReturn = chart.length > 20 ? chart[chart.length - 1].c / chart[0].c - 1 : null;

  // Peers
  let peers: SnapshotData["peers"] = null;
  if (src.peers?.peers.length) {
    const c = readComps(base, r, src.peers.peers);
    const b = base.history.at(-1)!;
    const ev = mcap + base.debt - base.cash;
    peers = {
      rows: src.peers.peers.slice(0, 5),
      medianEvEbitda: c.medianEvEbitda,
      medianPe: c.medianPe,
      valueAtMedian: c.valueAtMedian,
      selfEvEbitda: b.ebit + b.da > 0 ? ev / (b.ebit + b.da) : null,
    };
  }

  const options = atmOptions({ price, bars, curve: src.curve, tenYear: src.tenYear, dps: src.dps, earnings: src.earnings, today: src.today });

  const rev = reverseDcf(base);
  return {
    today: src.today,
    company: {
      name: base.company.name || base.company.ticker,
      ticker: base.company.ticker,
      baseYear: base.company.baseYearLabel,
      form: base.company.form ?? "10-K",
      currency: base.company.currency ?? null,
    },
    quote: {
      price,
      priceDate,
      change: q?.prevClose ? q.close - q.prevClose : null,
      changePct: q?.prevClose ? q.close / q.prevClose - 1 : null,
      open: q && Number.isFinite(q.open) ? q.open : null,
      high: q && Number.isFinite(q.high) ? q.high : null,
      low: q && Number.isFinite(q.low) ? q.low : null,
      volume: q?.volume ?? null,
      avgVolume: q?.avgVolume ?? null,
      high52: src.market?.high52 ?? null,
      low52: src.market?.low52 ?? null,
      marketCap: mcap * 1e6,
      pe: ni && ni > 0 ? mcap / ni : null,
      divYield: src.dps && price > 0 ? src.dps / price : null,
      beta: src.market?.beta?.adjusted ?? base.beta,
      nextEarnings: src.earnings?.date ?? null,
    },
    chart,
    yearReturn,
    trends,
    valuation: {
      value: r.impliedPrice,
      upside: r.impliedPrice / price - 1,
      wacc: r.wacc.wacc,
      method: base.terminalMethod,
      terminal: base.terminalMethod === "gordon" ? base.terminalGrowth : base.exitMultiple,
      tvShare: r.terminalShareOfEv,
      stars: starRating(checks),
      greenChecks: checks.filter((c) => c.level === "good").length,
      totalChecks: checks.length,
      cases: a.valid
        ? {
            bear: a.cases.bear.value,
            base: a.cases.base.value,
            bull: a.cases.bull.value,
            weighted: a.expected,
            weights: [a.weights.bear, a.weights.base, a.weights.bull],
          }
        : null,
      reverseWacc: rev.wacc,
      warn: r.years[4].ufcf <= 0 || r.enterpriseValue <= 0,
    },
    peers,
    options,
    issues: checks
      .filter((c) => c.level !== "good")
      .sort((x, y) => (x.level === "bad" ? -1 : 0) - (y.level === "bad" ? -1 : 0))
      .slice(0, 3)
      .map((c) => ({ title: c.title, message: c.message, level: c.level as "warn" | "bad" })),
  };
}

/** A standard at-the-money option three months out, priced with historical volatility. */
export function atmOptions(a: {
  price: number;
  bars: { d: string; c: number }[];
  curve: Curve | null;
  tenYear: number | null;
  dps: number | null;
  earnings: { date: string } | null;
  today: string;
}): SnapshotData["options"] {
  const hv = a.bars.length > 60 ? historicalVol(a.bars.map((x) => x.c)) : null;
  if (!hv || !(a.price > 0)) return null;
  const expiry = expiryIn(a.today, 3);
  const days = Math.max(daysBetween(a.today, expiry), 1);
  const T = days / 365;
  const quoted = a.curve ? yieldAt(a.curve, T)?.rate ?? a.tenYear : a.tenYear;
  const rate = continuousRate(quoted ?? 0.045);
  const K = roundStrike(a.price);
  const bs = blackScholes({ S: a.price, K, T, r: rate, q: a.dps ? a.dps / a.price : 0, sigma: hv.sigma });
  return {
    expiry,
    days,
    strike: K,
    call: bs.call,
    put: bs.put,
    vol: hv.sigma,
    rate: quoted ?? 0.045,
    expectedMove: a.price * hv.sigma * Math.sqrt(T),
    earningsBefore: !!a.earnings && a.earnings.date >= a.today && a.earnings.date <= expiry,
  };
}
