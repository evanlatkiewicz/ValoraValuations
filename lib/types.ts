// Core data shapes for Valora. All money values are in millions of dollars
// unless a field says otherwise. All rates are decimals (0.05 = 5%).

export type SourceKind = "filing" | "market" | "assumption" | "user";

export interface Source {
  kind: SourceKind;
  note?: string;
  url?: string;
}

export interface HistoricalYear {
  label: string; // e.g. "FY2026"
  revenue: number;
  ebit: number; // operating income
  da: number; // depreciation and amortization
  capex: number; // capital expenditures, positive number
}

export type TerminalMethod = "gordon" | "exit";

export interface DcfInputs {
  company: {
    name: string;
    ticker: string;
    baseYearLabel: string; // last actual fiscal year, e.g. "FY2026"
    priceDate: string; // when the share price was taken
    logo?: string; // company logo URL (Twelve Data)
  };
  history: HistoricalYear[]; // oldest first; last entry is the base year
  baseNwc: number; // operating net working capital at end of base year

  // Five projection years
  revenueGrowth: number[]; // length 5
  ebitMargin: number[]; // length 5
  taxRate: number;
  daPct: number; // D&A as % of revenue
  capexPct: number; // capex as % of revenue
  nwcPct: number; // operating NWC as % of revenue

  // Capital structure and market
  sharePrice: number; // dollars per share
  sharesOutstanding: number; // millions of shares
  cash: number; // cash plus marketable securities
  debt: number; // total debt

  // Discount rate
  riskFreeRate: number;
  beta: number;
  equityRiskPremium: number;
  preTaxCostOfDebt: number;

  // Terminal value
  terminalMethod: TerminalMethod;
  terminalGrowth: number;
  exitMultiple: number; // EV / EBITDA
  midYear: boolean;

  sources: Record<string, Source>;

  // Bull and bear cases. Missing means "derive them from the base case".
  scenarios?: import("./scenarios").Scenarios;
}

export interface ProjectedYear {
  label: string;
  revenue: number;
  growth: number;
  ebit: number;
  margin: number;
  taxes: number;
  nopat: number;
  da: number;
  capex: number;
  nwc: number;
  changeInNwc: number;
  ufcf: number;
  ebitda: number;
  period: number; // discounting period in years
  discountFactor: number;
  pvUfcf: number;
}

export interface WaccBuild {
  marketCap: number;
  debt: number;
  equityWeight: number;
  debtWeight: number;
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  wacc: number;
}

export interface DcfResult {
  years: ProjectedYear[];
  wacc: WaccBuild;
  terminal: {
    method: TerminalMethod;
    value: number; // undiscounted, at end of year 5
    pv: number;
    discountFactor: number;
    impliedExitMultiple: number; // TV / EBITDA in year 5
    impliedGrowth: number; // growth rate implied by TV
    valid: boolean; // false when g >= WACC under Gordon
  };
  sumPvUfcf: number;
  enterpriseValue: number;
  equityValue: number;
  impliedPrice: number;
  upside: number; // implied / current - 1
  terminalShareOfEv: number;
}
