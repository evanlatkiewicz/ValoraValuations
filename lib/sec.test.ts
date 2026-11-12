import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inputsFromFacts, fiscalLabel, SecDataError, type CompanyFacts } from "./sec";
import { APPLE } from "./companies";
import { runDcf } from "./dcf";

const load = (t: string) => JSON.parse(readFileSync(new URL(`./fixtures/${t}.json`, import.meta.url), "utf8")) as CompanyFacts;

describe("SEC loader", () => {
  it("matches the hand-checked Apple preset", () => {
    const { inputs } = inputsFromFacts(load("AAPL"), "aapl");
    expect(inputs.company.ticker).toBe("AAPL");
    expect(inputs.history).toEqual(APPLE.history);
    expect(Math.round(inputs.baseNwc)).toBe(APPLE.baseNwc);
    expect(Math.round(inputs.cash)).toBe(APPLE.cash);
    expect(Math.round(inputs.debt)).toBe(APPLE.debt);
    expect(inputs.sharesOutstanding).toBeCloseTo(14532.182, 2); // later cover-page count
    expect(inputs.taxRate).toBeCloseTo(0.17, 3);
  });

  it.each(["MSFT", "GOOGL", "AMZN", "NVDA", "KO", "WMT"])("%s loads a complete, valuable model", (t) => {
    const { inputs, warnings } = inputsFromFacts(load(t), t);
    expect(warnings).toEqual([]);
    expect(inputs.history).toHaveLength(3);
    const base = inputs.history.at(-1)!;
    for (const k of ["revenue", "ebit", "da", "capex"] as const) expect(base[k]).toBeGreaterThan(0);
    expect(inputs.sharesOutstanding).toBeGreaterThan(100);
    expect(inputs.debt).toBeGreaterThan(0);
    // Once a price is entered, the model produces a finite value
    const r = runDcf({ ...inputs, sharePrice: 100 });
    expect(Number.isFinite(r.impliedPrice)).toBe(true);
    expect(r.impliedPrice).toBeGreaterThan(0);
  });

  it("uses each company's own fiscal year", () => {
    expect(inputsFromFacts(load("WMT"), "WMT").inputs.company.baseYearLabel).toBe("FY2026"); // ends Jan 31, 2026
    expect(inputsFromFacts(load("GOOGL"), "GOOGL").inputs.company.baseYearLabel).toBe("FY2025");
    expect(fiscalLabel("2026-01-03")).toBe("FY2025");
  });

  it("warns instead of guessing when debt tags are missing", () => {
    const { warnings } = inputsFromFacts(load("F"), "F");
    expect(warnings.join(" ")).toMatch(/debt/i);
  });

  it("explains why banks can't be loaded", () => {
    expect(() => inputsFromFacts(load("JPM"), "JPM")).toThrow(SecDataError);
    expect(() => inputsFromFacts(load("JPM"), "JPM")).toThrow(/banks/);
  });

  it("leaves the share price blank for the user", () => {
    expect(inputsFromFacts(load("KO"), "KO").inputs.sharePrice).toBe(0);
  });
});
