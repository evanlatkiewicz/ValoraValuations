import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inputsFromFacts, fiscalLabel, reportingBook, SecDataError, tidyName, type CompanyFacts } from "./sec";
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
    expect(warnings.filter((w) => !/depreciation/i.test(w))).toEqual([]);
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

describe("company names", () => {
  it("drops SEC filing tags and fixes all caps", () => {
    expect(tidyName("Costco Wholesale Corp /new")).toBe("Costco Wholesale Corp");
    expect(tidyName("NIKE, Inc.")).toBe("NIKE, Inc.");
    expect(tidyName("MICROSOFT CORP")).toBe("Microsoft Corp");
    expect(tidyName("EXAMPLE HOLDINGS INC /DE/")).toBe("Example Holdings Inc");
    expect(tidyName("Apple Inc.")).toBe("Apple Inc.");
  });
});

describe("foreign filers (20-F)", () => {
  const fx = (currency: string, rate: number) => ({ currency, rate, date: "2026-11-12", source: "test" });

  it("reads US GAAP in euros and converts to dollars (ASML)", () => {
    const f = load("ASML");
    expect(reportingBook(f)).toEqual({ tax: "us-gaap", unit: "EUR", form: "20-F" });
    const eur = inputsFromFacts(f, "ASML", undefined, fx("EUR", 1)).inputs;
    const usd = inputsFromFacts(f, "ASML", undefined, fx("EUR", 1.2)).inputs;
    expect(usd.history.at(-1)!.revenue).toBeCloseTo(eur.history.at(-1)!.revenue * 1.2, 6);
    expect(usd.cash).toBeCloseTo(eur.cash * 1.2, 6);
    expect(usd.ebitMargin).toEqual(eur.ebitMargin); // ratios don't move with the rate
    expect(usd.company.name).toBe("ASML Holding NV");
    expect(usd.sources.history.note).toMatch(/20-F.*euros/);
  });

  it("needs an exchange rate for non-dollar reporters", () => {
    expect(() => inputsFromFacts(load("ASML"), "ASML")).toThrow(/euros/);
  });

  it("reads a dollar 20-F with a March year end (ARM)", () => {
    const { inputs } = inputsFromFacts(load("ARM"), "ARM");
    expect(inputs.company.baseYearLabel).toBe("FY2026");
    expect(inputs.history.at(-1)!.revenue).toBeGreaterThan(4000);
  });

  it.each([["TSM", "TWD", 1 / 30], ["NVO", "DKK", 0.15]])("reads IFRS filings (%s)", (t, cur, rate) => {
    const f = load(t);
    expect(reportingBook(f)).toMatchObject({ tax: "ifrs-full", unit: cur });
    const { inputs, warnings } = inputsFromFacts(f, t, undefined, fx(cur, rate));
    const base = inputs.history.at(-1)!;
    for (const k of ["revenue", "ebit", "da", "capex"] as const) expect(base[k]).toBeGreaterThan(0);
    expect(inputs.debt).toBeGreaterThan(0);
    expect(inputs.sharesOutstanding).toBeGreaterThan(1000);
    expect(warnings.join(" ")).toMatch(/converted to US dollars/);
    const r = runDcf({ ...inputs, sharePrice: 100 });
    expect(r.impliedPrice).toBeGreaterThan(0);
  });

  it("counts shares per ADR (TSMC: one ADR is five shares)", () => {
    const { inputs } = inputsFromFacts(load("TSM"), "TSM", undefined, fx("TWD", 1 / 30));
    expect(inputs.sharesOutstanding).toBeCloseTo(25932.9 / 5, 0);
    expect(inputs.sources.sharesOutstanding.note).toMatch(/divided by 5/);
  });

  it("keeps A/S in Novo Nordisk's name", () => {
    expect(tidyName("NOVO NORDISK A/S")).toBe("Novo Nordisk A/S");
    expect(tidyName("ARM HOLDINGS PLC /UK", "ARM")).toBe("ARM Holdings PLC");
  });
});

describe("companies Valora can't value", () => {
  const facts = (gaap: Record<string, { start?: string; end: string; val: number }[]>) =>
    ({
      cik: 1,
      entityName: "TEST BIO INC",
      facts: {
        "us-gaap": Object.fromEntries(
          Object.entries(gaap).map(([k, xs]) => [k, { units: { USD: xs.map((x) => ({ ...x, accn: "a", form: "10-K", filed: "2026-03-01" })) } }]),
        ),
      },
    }) as CompanyFacts;

  it("explains a pre-revenue company", () => {
    const f = facts({ OperatingIncomeLoss: [{ start: "2025-01-01", end: "2025-12-31", val: -1.2e8 }] });
    expect(() => inputsFromFacts(f, "TBIO")).toThrow(/hasn't reported any revenue yet/);
  });

  it("explains a company with no annual report yet", () => {
    const f = { cik: 1, entityName: "NEW CO", facts: { "us-gaap": {} } } as CompanyFacts;
    expect(() => inputsFromFacts(f, "NEW")).toThrow(/hasn't filed an annual report/);
  });

  it("reads industry revenue labels when the usual ones are missing", () => {
    const f = facts({
      RegulatedAndUnregulatedOperatingRevenue: [
        { start: "2024-01-01", end: "2024-12-31", val: 2e10 },
        { start: "2025-01-01", end: "2025-12-31", val: 2.2e10 },
      ],
      OperatingIncomeLoss: [
        { start: "2024-01-01", end: "2024-12-31", val: 5e9 },
        { start: "2025-01-01", end: "2025-12-31", val: 6e9 },
      ],
    });
    expect(inputsFromFacts(f, "UTIL").inputs.history.at(-1)!.revenue).toBe(22000);
  });
});
