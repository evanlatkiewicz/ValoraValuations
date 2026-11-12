import type { DcfInputs } from "./types";

const FY26_RELEASE =
  "https://www.sec.gov/Archives/edgar/data/0000320193/000032019326000024/a8-kex991q4202609262026.htm";
const FY25_RELEASE = "https://www.apple.com/newsroom/pdfs/fy2025-q4/FY25_Q4_Consolidated_Financial_Statements.pdf";

/**
 * Apple, loaded from its fiscal 2026 results (year ended Sep 26, 2026).
 * $ in millions, shares in millions.
 *
 * Operating NWC at FY2026 year end:
 *   (AR 43,817 + vendor non-trade 39,896 + inventory 14,541 + other current 18,881)
 *   - (AP 82,252 + other current liabilities 66,124 + deferred revenue 9,636)
 *   = 117,135 - 158,012 = -40,877
 * Cash = cash 36,305 + current securities 20,417 + non-current securities 80,213 = 136,935
 * Debt = commercial paper 1,997 + term debt 9,906 + 68,208 = 80,111
 */
export const APPLE: DcfInputs = {
  company: {
    name: "Apple Inc.",
    ticker: "AAPL",
    baseYearLabel: "FY2026",
    priceDate: "Nov 10, 2026",
  },
  history: [
    { label: "FY2024", revenue: 391035, ebit: 123216, da: 11445, capex: 9447 },
    { label: "FY2025", revenue: 416161, ebit: 133050, da: 11698, capex: 12715 },
    { label: "FY2026", revenue: 478834, ebit: 158063, da: 13423, capex: 9041 },
  ],
  baseNwc: -40877,
  revenueGrowth: [0.09, 0.08, 0.07, 0.06, 0.05],
  ebitMargin: [0.325, 0.325, 0.325, 0.325, 0.325],
  taxRate: 0.17,
  daPct: 0.028,
  capexPct: 0.028,
  nwcPct: -0.085,
  sharePrice: 350.35,
  sharesOutstanding: 14532.259,
  cash: 136935,
  debt: 80111,
  riskFreeRate: 0.05,
  beta: 1.06,
  equityRiskPremium: 0.0425,
  preTaxCostOfDebt: 0.052,
  terminalMethod: "gordon",
  terminalGrowth: 0.03,
  exitMultiple: 18,
  midYear: false,
  sources: {
    history: { kind: "filing", note: "Apple FY2026 and FY2025 Q4 results (10-K figures)", url: FY26_RELEASE },
    baseNwc: { kind: "filing", note: "Operating current assets minus operating current liabilities, Sep 26, 2026 balance sheet", url: FY26_RELEASE },
    revenueGrowth: { kind: "assumption", note: "FY2026 grew 15.1% on a strong iPhone cycle. Starting at 9% and fading to 5% assumes that pace normalizes." },
    ebitMargin: { kind: "assumption", note: "FY2026 margin was 33.0%, helped by about 1 point of one-time tariff refunds. 32.5% backs that out." },
    taxRate: { kind: "filing", note: "FY2026 effective rate: 27,062 / 159,237 = 17.0%", url: FY26_RELEASE },
    daPct: { kind: "filing", note: "FY2026 D&A of 13,423 is 2.8% of revenue", url: FY26_RELEASE },
    capexPct: { kind: "assumption", note: "Capex was 1.9% of revenue in FY2026 and 3.1% in FY2025. 2.8% keeps capex in line with D&A." },
    nwcPct: { kind: "filing", note: "Apple runs negative working capital: -40,877 / 478,834 = -8.5% of revenue", url: FY26_RELEASE },
    sharePrice: { kind: "market", note: "AAPL close, Nov 10, 2026. Update to today's price." },
    sharesOutstanding: { kind: "filing", note: "14,532,259 thousand shares outstanding at Sep 26, 2026", url: FY26_RELEASE },
    cash: { kind: "filing", note: "Cash 36,305 + current securities 20,417 + non-current securities 80,213", url: FY26_RELEASE },
    debt: { kind: "filing", note: "Commercial paper 1,997 + term debt 9,906 (current) + 68,208 (non-current)", url: FY26_RELEASE },
    riskFreeRate: { kind: "market", note: "10-year Treasury was around 5.0% in late October 2026. Check today's yield." },
    beta: { kind: "market", note: "Reported AAPL beta of about 1.06. Betas vary by provider and time window." },
    equityRiskPremium: { kind: "market", note: "Damodaran's implied US ERP was about 4.2% to 4.3% in 2026.", url: "https://pages.stern.nyu.edu/~adamodar/" },
    preTaxCostOfDebt: { kind: "assumption", note: "Apple is a top-rated borrower, so roughly the Treasury yield plus a small spread." },
    terminalGrowth: { kind: "assumption", note: "Roughly long-run inflation plus modest real growth." },
    exitMultiple: { kind: "assumption", note: "Only used if you switch to the exit multiple method." },
    fy25: { kind: "filing", note: "FY2025 and FY2024 figures", url: FY25_RELEASE },
  },
};

/** An empty template for building a model from scratch. */
export function blankInputs(): DcfInputs {
  return {
    company: { name: "", ticker: "", baseYearLabel: "FY2026", priceDate: "" },
    history: [
      { label: "FY2025", revenue: 0, ebit: 0, da: 0, capex: 0 },
      { label: "FY2026", revenue: 0, ebit: 0, da: 0, capex: 0 },
    ],
    baseNwc: 0,
    revenueGrowth: [0.06, 0.05, 0.05, 0.04, 0.04],
    ebitMargin: [0.15, 0.15, 0.15, 0.15, 0.15],
    taxRate: 0.21,
    daPct: 0.03,
    capexPct: 0.035,
    nwcPct: 0.05,
    sharePrice: 0,
    sharesOutstanding: 0,
    cash: 0,
    debt: 0,
    riskFreeRate: 0.045,
    beta: 1.0,
    equityRiskPremium: 0.045,
    preTaxCostOfDebt: 0.055,
    terminalMethod: "gordon",
    terminalGrowth: 0.025,
    exitMultiple: 12,
    midYear: false,
    sources: {},
  };
}
