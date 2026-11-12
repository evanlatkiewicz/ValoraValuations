import { describe, expect, it } from "vitest";
import { APPLE } from "./companies";
import { runDcf } from "./dcf";
import { analyze, caseInputs, defaultCase, driverSteps, getScenarios, normalize } from "./scenarios";
import { decodeAny, encodeCompact } from "./share";

describe("scenarios", () => {
  it("base case is the model itself", () => {
    expect(caseInputs(APPLE, "base")).toBe(APPLE);
    const a = analyze(APPLE);
    expect(a.cases.base.value).toBeCloseTo(runDcf(APPLE).impliedPrice, 9);
  });

  it("bull is worth more than base, base more than bear", () => {
    const a = analyze(APPLE);
    expect(a.cases.bull.value).toBeGreaterThan(a.cases.base.value);
    expect(a.cases.base.value).toBeGreaterThan(a.cases.bear.value);
  });

  it("only changes the case fields; discount rate and balance sheet are shared", () => {
    const bull = caseInputs(APPLE, "bull");
    expect(bull.beta).toBe(APPLE.beta);
    expect(bull.debt).toBe(APPLE.debt);
    expect(bull.revenueGrowth[0]).toBeCloseTo(APPLE.revenueGrowth[0] + 0.02, 9);
    expect(runDcf(bull).wacc.wacc).toBeCloseTo(runDcf(APPLE).wacc.wacc, 12);
  });

  it("keeps bull terminal growth below WACC", () => {
    const hot = { ...APPLE, terminalGrowth: 0.08 };
    const c = defaultCase(hot, 1);
    expect(c.terminalGrowth).toBeLessThan(runDcf(hot).wacc.wacc);
  });

  it("weighted value, spread and odds match a hand calculation", () => {
    const a = analyze(APPLE);
    const [b, m, u] = [a.cases.bear.value, a.cases.base.value, a.cases.bull.value];
    const e = 0.25 * b + 0.5 * m + 0.25 * u;
    expect(a.expected).toBeCloseTo(e, 9);
    expect(a.stdev).toBeCloseTo(Math.sqrt(0.25 * (b - e) ** 2 + 0.5 * (m - e) ** 2 + 0.25 * (u - e) ** 2), 9);
    expect(a.skew).toBeCloseTo((u - m) / (m - b), 9);
    const above = [b, m, u].map((v, k) => (v > APPLE.sharePrice ? [0.25, 0.5, 0.25][k] : 0)).reduce((x, y) => x + y, 0);
    expect(a.probAbovePrice).toBeCloseTo(above, 9);
  });

  it("market-implied bull odds put the weighted value on today's price", () => {
    const price = (analyze(APPLE).cases.bear.value + analyze(APPLE).cases.bull.value) / 2;
    const a = analyze({ ...APPLE, sharePrice: price });
    const p = a.impliedBullProb!;
    expect(p * a.cases.bull.value + (1 - p) * a.cases.bear.value).toBeCloseTo(price, 9);
    expect(analyze(APPLE).priceVsRange).toBe("above"); // Apple trades above even the bull case here
  });

  it("driver steps add up to the full gap between cases", () => {
    for (const t of ["bull", "bear"] as const) {
      const sum = driverSteps(APPLE, t).reduce((s, d) => s + d.delta, 0);
      const a = analyze(APPLE);
      expect(sum).toBeCloseTo(a.cases[t].value - a.cases.base.value, 9);
    }
  });

  it("normalizes weights", () => {
    expect(normalize({ bear: 1, base: 2, bull: 1 })).toEqual({ bear: 0.25, base: 0.5, bull: 0.25 });
    expect(normalize({ bear: 0, base: 0, bull: 0 })).toEqual({ bear: 0.25, base: 0.5, bull: 0.25 });
  });

  it("saved scenarios survive a share link", async () => {
    const s = getScenarios(APPLE);
    const withCases = { ...APPLE, scenarios: { ...s, bull: { ...s.bull, terminalGrowth: 0.035 }, weights: { bear: 0.2, base: 0.5, bull: 0.3 } } };
    expect(await decodeAny(await encodeCompact(withCases))).toEqual(withCases);
  });
});
