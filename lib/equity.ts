// The excess return model, for banks, insurers, REITs and other financial
// companies, where debt is part of the business and free cash flow has no
// clean meaning. A company is worth its book equity plus the present value of
// the profit it earns above what shareholders require:
//
//   excess return in year t = (ROE_t − cost of equity) × book equity at the start of year t
//   value = book equity today + PV(excess returns, years 1–5) + PV(terminal value)
//   terminal value = (long-run ROE − cost of equity) × book equity in year 5 / (cost of equity − g)
//
// Book equity grows by the earnings the company keeps: BV_t = BV_{t−1} + NI_t − payouts_t.

export interface EquityYear {
  label: string;
  netIncome: number; // to common shareholders, $ millions
  bookEquity: number; // common equity at year end, $ millions
  payouts: number; // common dividends plus buybacks, $ millions
}

export type FinKind = "bank" | "insurer" | "reit" | "financial";

export const KIND_LABEL: Record<FinKind, string> = { bank: "Bank", insurer: "Insurer", reit: "Real estate trust (REIT)", financial: "Financial company" };

export interface EquityInputs {
  company: {
    name: string;
    ticker: string;
    baseYearLabel: string;
    priceDate: string;
    logo?: string;
    form?: string;
    currency?: string;
    kind: FinKind;
  };
  history: EquityYear[]; // oldest first; last is the base year
  bookEquity: number; // common equity at the end of the base year, $ millions
  roe: number[]; // forecast return on equity, years 1–5
  longRunRoe: number; // ROE after year 5
  payoutRatio: number; // share of earnings returned through dividends and buybacks
  sharePrice: number;
  sharesOutstanding: number; // millions
  riskFreeRate: number;
  beta: number;
  equityRiskPremium: number;
  terminalGrowth: number;
  sources: Record<string, { kind: "filing" | "market" | "assumption" | "user"; note?: string; url?: string }>;
}

export interface EquityProjection {
  label: string;
  startBook: number;
  roe: number;
  netIncome: number;
  payouts: number;
  endBook: number;
  equityCharge: number; // cost of equity × starting book
  excessReturn: number;
  discountFactor: number;
  pv: number;
}

export interface EquityResult {
  costOfEquity: number;
  years: EquityProjection[];
  sumPv: number;
  terminal: { excessReturn: number; value: number; pv: number; valid: boolean };
  equityValue: number; // $ millions
  valuePerShare: number;
  bookPerShare: number;
  impliedPriceToBook: number;
  marketPriceToBook: number;
  upside: number;
  terminalShare: number; // terminal PV as a share of value above book... of total value
  sustainableGrowth: number; // long-run ROE × retention
}

export const costOfEquity = (i: Pick<EquityInputs, "riskFreeRate" | "beta" | "equityRiskPremium">) =>
  i.riskFreeRate + i.beta * i.equityRiskPremium;

export function forecastLabels(base: string): string[] {
  const y = Number(base.replace(/\D/g, ""));
  return [1, 2, 3, 4, 5].map((k) => (Number.isFinite(y) ? `FY${y + k}` : `Year ${k}`));
}

export function runEquity(i: EquityInputs): EquityResult {
  const ke = costOfEquity(i);
  const labels = forecastLabels(i.company.baseYearLabel);
  let book = i.bookEquity;
  let sumPv = 0;
  const years: EquityProjection[] = i.roe.slice(0, 5).map((roe, k) => {
    const netIncome = roe * book;
    const payouts = netIncome > 0 ? netIncome * i.payoutRatio : 0;
    const equityCharge = ke * book;
    const excessReturn = netIncome - equityCharge;
    const discountFactor = 1 / Math.pow(1 + ke, k + 1);
    const pv = excessReturn * discountFactor;
    const row = { label: labels[k], startBook: book, roe, netIncome, payouts, endBook: book + netIncome - payouts, equityCharge, excessReturn, discountFactor, pv };
    sumPv += pv;
    book = row.endBook;
    return row;
  });
  const valid = ke > i.terminalGrowth;
  const terminalExcess = (i.longRunRoe - ke) * book;
  const tv = valid ? terminalExcess / (ke - i.terminalGrowth) : NaN;
  const tvPv = valid ? tv * (years.at(-1)?.discountFactor ?? 1) : NaN;
  const equityValue = i.bookEquity + sumPv + tvPv;
  const shares = i.sharesOutstanding;
  const valuePerShare = shares > 0 ? equityValue / shares : NaN;
  const bookPerShare = shares > 0 ? i.bookEquity / shares : NaN;
  return {
    costOfEquity: ke,
    years,
    sumPv,
    terminal: { excessReturn: terminalExcess, value: tv, pv: tvPv, valid },
    equityValue,
    valuePerShare,
    bookPerShare,
    impliedPriceToBook: valuePerShare / bookPerShare,
    marketPriceToBook: i.sharePrice > 0 ? i.sharePrice / bookPerShare : NaN,
    upside: i.sharePrice > 0 ? valuePerShare / i.sharePrice - 1 : NaN,
    terminalShare: equityValue > 0 ? tvPv / equityValue : NaN,
    sustainableGrowth: i.longRunRoe * (1 - i.payoutRatio),
  };
}

/** The long-run ROE that would make the model land on today's price, by bisection. */
export function impliedLongRunRoe(i: EquityInputs): number | null {
  if (!(i.sharePrice > 0)) return null;
  const f = (roe: number) => runEquity({ ...i, longRunRoe: roe }).valuePerShare - i.sharePrice;
  let lo = -0.2, hi = 0.6;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Value per share across long-run ROE (rows) and cost of equity (columns), shifting beta's effect through the ERP-free rate. */
export function equitySensitivity(i: EquityInputs, dRoe: number[], dKe: number[]): number[][] {
  const ke0 = costOfEquity(i);
  return dRoe.map((dr) =>
    dKe.map((dk) => {
      // Move the cost of equity by changing the risk-free rate, so beta and ERP stay as entered
      const shifted = { ...i, longRunRoe: i.longRunRoe + dr, riskFreeRate: i.riskFreeRate + dk };
      return costOfEquity(shifted) > i.terminalGrowth && ke0 + dk > 0 ? runEquity(shifted).valuePerShare : NaN;
    }),
  );
}
