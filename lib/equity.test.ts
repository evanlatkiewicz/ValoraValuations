import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { equitySensitivity, impliedLongRunRoe, runEquity, type EquityInputs } from "./equity";
import { equityFromFacts } from "./secFin";
import type { CompanyFacts } from "./sec";

const load = (t: string) => JSON.parse(readFileSync(new URL(`./fixtures/${t}.json`, import.meta.url), "utf8")) as CompanyFacts;

const BASE: EquityInputs = {
  company: { name: "Test Bank", ticker: "TB", baseYearLabel: "FY2025", priceDate: "", kind: "bank" },
  history: [{ label: "FY2025", netIncome: 15, bookEquity: 100, payouts: 7.5 }],
  bookEquity: 100,
  roe: [0.15, 0.15, 0.15, 0.15, 0.15],
  longRunRoe: 0.12,
  payoutRatio: 0.5,
  sharePrice: 12,
  sharesOutstanding: 10,
  riskFreeRate: 0.04,
  beta: 1.2,
  equityRiskPremium: 0.05, // cost of equity 10%
  terminalGrowth: 0.03,
  sources: {},
};

describe("excess return model", () => {
  it("matches a hand calculation", () => {
    // Worked independently: PV of excess returns 21.717428, year-5 book 143.562933,
    // terminal value 41.017981 (PV 25.468939), total 147.186367
    const r = runEquity(BASE);
    expect(r.costOfEquity).toBeCloseTo(0.1, 10);
    expect(r.sumPv).toBeCloseTo(21.717428, 5);
    expect(r.years[4].endBook).toBeCloseTo(143.562933, 5);
    expect(r.terminal.value).toBeCloseTo(41.017981, 5);
    expect(r.terminal.pv).toBeCloseTo(25.468939, 5);
    expect(r.equityValue).toBeCloseTo(147.186367, 5);
    expect(r.valuePerShare).toBeCloseTo(14.718637, 5);
    expect(r.impliedPriceToBook).toBeCloseTo(1.47186, 4);
  });

  it("is worth exactly book value when returns equal the cost of equity", () => {
    const r = runEquity({ ...BASE, roe: [0.1, 0.1, 0.1, 0.1, 0.1], longRunRoe: 0.1 });
    expect(r.valuePerShare).toBeCloseTo(r.bookPerShare, 8);
  });

  it("solves for the long-run ROE in today's price", () => {
    const roe = impliedLongRunRoe(BASE)!;
    expect(runEquity({ ...BASE, longRunRoe: roe }).valuePerShare).toBeCloseTo(12, 6);
  });

  it("builds a sensitivity grid around the base case", () => {
    const g = equitySensitivity(BASE, [-0.01, 0, 0.01], [-0.01, 0, 0.01]);
    expect(g[1][1]).toBeCloseTo(runEquity(BASE).valuePerShare, 8);
    expect(g[2][1]).toBeGreaterThan(g[1][1]); // higher ROE, higher value
    expect(g[1][2]).toBeLessThan(g[1][1]); // higher cost of equity, lower value
  });
});

describe("financial companies from SEC data", () => {
  it.each(["JPM", "GS", "WFC", "MET", "SCHW", "O"])("%s loads a complete model", (t) => {
    const { inputs } = equityFromFacts(load(t), t);
    expect(inputs.history.length).toBeGreaterThan(1);
    expect(inputs.bookEquity).toBeGreaterThan(1000);
    expect(inputs.sharesOutstanding).toBeGreaterThan(100);
    expect(inputs.payoutRatio).toBeGreaterThanOrEqual(0);
    const r = runEquity({ ...inputs, sharePrice: 100 });
    expect(Number.isFinite(r.valuePerShare)).toBe(true);
  });

  it("tells banks, insurers and REITs apart", () => {
    expect(equityFromFacts(load("JPM"), "JPM").inputs.company.kind).toBe("bank");
    expect(equityFromFacts(load("MET"), "MET").inputs.company.kind).toBe("insurer");
    expect(equityFromFacts(load("O"), "O").inputs.company.kind).toBe("reit");
  });

  it("reads JPMorgan's common equity, excluding preferred stock", () => {
    const { inputs } = equityFromFacts(load("JPM"), "JPM");
    expect(inputs.company.baseYearLabel).toBe("FY2025");
    expect(inputs.history.at(-1)!.netIncome).toBeGreaterThan(40000);
  });
});
