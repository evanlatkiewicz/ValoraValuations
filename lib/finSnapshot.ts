// Gathers the bank and insurer snapshot's numbers. Pure, like lib/snapshot.ts.
import { forecastLabels, impliedLongRunRoe, KIND_LABEL, runEquity, type EquityInputs } from "./equity";
import { equityChecks } from "./equityChecks";
import { starRating } from "./checks";
import { median, type PeerRow } from "./comps";
import { atmOptions, type SnapshotData } from "./snapshot";
import type { Curve } from "./curve";
import type { MarketData } from "./market";

export interface FinSnapshotData {
  today: string;
  company: { name: string; ticker: string; baseYear: string; form: string; currency: string | null; kindLabel: string };
  quote: SnapshotData["quote"];
  chart: SnapshotData["chart"];
  yearReturn: number | null;
  trends: { label: string; projected: boolean; netIncome: number; bookEquity: number; roe: number | null; payouts: number }[];
  valuation: {
    value: number;
    upside: number;
    costOfEquity: number;
    longRunRoe: number;
    terminalGrowth: number;
    bookPerShare: number;
    impliedPb: number;
    marketPb: number;
    parts: { book: number; excess: number; terminal: number }; // per share
    stars: number;
    greenChecks: number;
    totalChecks: number;
    impliedRoe: number | null;
  };
  peers: { rows: PeerRow[]; selfPb: number; selfPe: number | null; medianPb: number | null; medianPe: number | null; valueAtMedianPb: number | null } | null;
  options: SnapshotData["options"];
  issues: { title: string; message: string; level: "warn" | "bad" }[];
}

export function buildFinSnapshot(src: {
  model: EquityInputs;
  market: MarketData | null;
  curve: Curve | null;
  tenYear: number | null;
  peers: PeerRow[] | null;
  earnings: { date: string; epsEstimated: number | null } | null;
  dps: number | null;
  today: string;
}): FinSnapshotData {
  const q = src.market?.quote;
  const price = q && Number.isFinite(q.close) && q.close > 0 ? q.close : src.model.sharePrice;
  const m = { ...src.model, sharePrice: price };
  const r = runEquity(m);
  const checks = equityChecks(m, r);
  const sh = m.sharesOutstanding;
  const mcap = price * sh; // $ millions
  const base = m.history.at(-1)!;
  const selfPe = base.netIncome > 0 ? mcap / base.netIncome : null;
  const bars = src.market?.bars ?? [];
  const chart = bars.slice(-252);
  const labels = forecastLabels(m.company.baseYearLabel);

  const trends: FinSnapshotData["trends"] = [
    ...m.history.map((h, i) => {
      const prev = i > 0 ? m.history[i - 1].bookEquity : h.bookEquity;
      const avg = (prev + h.bookEquity) / 2;
      return { label: h.label, projected: false, netIncome: h.netIncome, bookEquity: h.bookEquity, roe: avg > 0 ? h.netIncome / avg : null, payouts: h.payouts };
    }),
    ...r.years.map((y, i) => ({ label: labels[i], projected: true, netIncome: y.netIncome, bookEquity: y.endBook, roe: y.roe, payouts: y.payouts })),
  ];

  let peers: FinSnapshotData["peers"] = null;
  if (src.peers?.length) {
    const medianPb = median(src.peers.map((p) => p.pb ?? null));
    peers = {
      rows: src.peers.slice(0, 5),
      selfPb: r.marketPriceToBook,
      selfPe,
      medianPb,
      medianPe: median(src.peers.map((p) => p.pe)),
      valueAtMedianPb: medianPb !== null ? medianPb * r.bookPerShare : null,
    };
  }

  return {
    today: src.today,
    company: {
      name: m.company.name,
      ticker: m.company.ticker,
      baseYear: m.company.baseYearLabel,
      form: m.company.form ?? "10-K",
      currency: m.company.currency ?? null,
      kindLabel: KIND_LABEL[m.company.kind],
    },
    quote: {
      price,
      priceDate: q?.date ?? m.company.priceDate ?? src.today,
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
      pe: selfPe,
      divYield: src.dps && price > 0 ? src.dps / price : null,
      beta: src.market?.beta?.adjusted ?? m.beta,
      nextEarnings: src.earnings?.date ?? null,
    },
    chart,
    yearReturn: chart.length > 20 ? chart[chart.length - 1].c / chart[0].c - 1 : null,
    trends,
    valuation: {
      value: r.valuePerShare,
      upside: r.upside,
      costOfEquity: r.costOfEquity,
      longRunRoe: m.longRunRoe,
      terminalGrowth: m.terminalGrowth,
      bookPerShare: r.bookPerShare,
      impliedPb: r.impliedPriceToBook,
      marketPb: r.marketPriceToBook,
      parts: { book: m.bookEquity / sh, excess: r.sumPv / sh, terminal: (r.terminal.valid ? r.terminal.pv : 0) / sh },
      stars: starRating(checks),
      greenChecks: checks.filter((c) => c.level === "good").length,
      totalChecks: checks.length,
      impliedRoe: impliedLongRunRoe(m),
    },
    peers,
    options: atmOptions({ price, bars, curve: src.curve, tenYear: src.tenYear, dps: src.dps, earnings: src.earnings, today: src.today }),
    issues: checks
      .filter((c) => c.level !== "good")
      .sort((x, y) => (x.level === "bad" ? -1 : 0) - (y.level === "bad" ? -1 : 0))
      .slice(0, 3)
      .map((c) => ({ title: c.title, message: c.message, level: c.level as "warn" | "bad" })),
  };
}
