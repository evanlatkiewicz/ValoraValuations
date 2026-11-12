// Numbers from Valora's Apple model, used as worked examples on the Learn pages.
import { APPLE } from "./companies";
import { computeWacc, reverseDcf, runDcf } from "./dcf";
import { moneyB, mult, pct, price } from "./format";

const r = runDcf(APPLE);
const w = computeWacc(APPLE).wacc;
const rev = reverseDcf(APPLE);

export const EX = {
  company: "Apple",
  baseYear: APPLE.company.baseYearLabel,
  firstYear: r.years[0].label,
  revenue: moneyB(APPLE.history.at(-1)!.revenue),
  fcf1: moneyB(r.years[0].ufcf),
  fcf5: moneyB(r.years[4].ufcf),
  sumPv: moneyB(r.sumPvUfcf),
  tv: moneyB(r.terminal.value),
  pvTv: moneyB(r.terminal.pv),
  ev: moneyB(r.enterpriseValue),
  debt: moneyB(APPLE.debt),
  cash: moneyB(APPLE.cash),
  equity: moneyB(r.equityValue),
  shares: `${(APPLE.sharesOutstanding / 1000).toFixed(2)} billion`,
  price: price(r.impliedPrice),
  market: price(APPLE.sharePrice),
  marketDate: APPLE.company.priceDate,
  upside: pct(Math.abs(r.upside), 0),
  wacc: pct(w, 1),
  costOfEquity: pct(r.wacc.costOfEquity, 1),
  rf: pct(APPLE.riskFreeRate, 1),
  beta: APPLE.beta.toFixed(2),
  erp: pct(APPLE.equityRiskPremium, 2),
  g: pct(APPLE.terminalGrowth, 1),
  tvShare: pct(r.terminalShareOfEv, 0),
  impliedMultiple: mult(r.terminal.impliedExitMultiple),
  waccUp: price(runDcf(APPLE, { wacc: w + 0.01 }).impliedPrice),
  waccDown: price(runDcf(APPLE, { wacc: w - 0.01 }).impliedPrice),
  gUp: price(runDcf(APPLE, { terminalGrowth: APPLE.terminalGrowth + 0.005 }).impliedPrice),
  gDown: price(runDcf(APPLE, { terminalGrowth: APPLE.terminalGrowth - 0.005 }).impliedPrice),
  midYear: price(runDcf({ ...APPLE, midYear: true }).impliedPrice),
  revWacc: rev.wacc !== null ? pct(rev.wacc, 1) : "n/a",
  revG: rev.terminalGrowth !== null ? pct(rev.terminalGrowth, 1) : "n/a",
  tax: pct(APPLE.taxRate, 0),
  taxShield: (10 * APPLE.taxRate).toFixed(2),
};
