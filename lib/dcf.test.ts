import { describe, expect, it } from "vitest";
import excel from "../verification/excel-results.json";
import { scenarios } from "../verification/make-scenarios";
import { reverseDcf, runDcf, sensitivity } from "./dcf";
import { runChecks, starRating } from "./checks";
import { APPLE } from "./companies";
import { decodeInputs, encodeInputs } from "./share";

const close = (a: number, b: number, rel = 1e-9) =>
  expect(Math.abs(a - b) / Math.max(1, Math.abs(b))).toBeLessThan(rel);

describe("engine matches the independent Excel workbook", () => {
  for (const [name, inputs] of Object.entries(scenarios)) {
    it(name, () => {
      const r = runDcf(inputs);
      const x = (excel as Record<string, Record<string, number>>)[name];
      close(r.wacc.wacc, x.wacc);
      close(r.years[4].ufcf, x.ufcf5);
      close(r.sumPvUfcf, x.sumPv);
      close(r.terminal.value, x.tv);
      close(r.terminal.pv, x.pvTv);
      close(r.enterpriseValue, x.ev);
      close(r.equityValue, x.equity);
      close(r.impliedPrice, x.price);
    });
  }
});

describe("core math", () => {
  it("implied exit multiple and implied growth are consistent", () => {
    const r = runDcf(APPLE);
    // Feeding the implied multiple back in as an exit multiple gives the same value
    const r2 = runDcf({ ...APPLE, terminalMethod: "exit", exitMultiple: r.terminal.impliedExitMultiple });
    close(r2.impliedPrice, r.impliedPrice, 1e-9);
    // Implied growth from the Gordon TV equals the input growth
    close(r.terminal.impliedGrowth, APPLE.terminalGrowth, 1e-9);
  });

  it("flags growth at or above WACC as invalid", () => {
    const r = runDcf({ ...APPLE, terminalGrowth: 0.2 });
    expect(r.terminal.valid).toBe(false);
    const checks = runChecks({ ...APPLE, terminalGrowth: 0.2 }, r);
    expect(checks.find((c) => c.id === "tgr")?.level).toBe("bad");
  });

  it("reverse DCF solves back to the market price", () => {
    const rev = reverseDcf(APPLE);
    expect(rev.wacc).not.toBeNull();
    expect(rev.terminalGrowth).not.toBeNull();
    close(runDcf(APPLE, { wacc: rev.wacc! }).impliedPrice, APPLE.sharePrice, 1e-6);
    close(runDcf(APPLE, { terminalGrowth: rev.terminalGrowth! }).impliedPrice, APPLE.sharePrice, 1e-6);
  });

  it("sensitivity center cell equals the base case", () => {
    const s = sensitivity(APPLE, [-0.01, 0, 0.01], [-0.005, 0, 0.005]);
    close(s.prices[1][1], runDcf(APPLE).impliedPrice);
    // Higher WACC lowers value, higher growth raises it
    expect(s.prices[0][1]).toBeGreaterThan(s.prices[2][1]);
    expect(s.prices[1][2]).toBeGreaterThan(s.prices[1][0]);
  });
});

describe("checks and stars", () => {
  it("Apple defaults score well", () => {
    const checks = runChecks(APPLE, runDcf(APPLE));
    expect(checks.filter((c) => c.level === "bad")).toHaveLength(0);
    expect(starRating(checks)).toBeGreaterThanOrEqual(4);
  });

  it("aggressive assumptions lose stars", () => {
    const wild = { ...APPLE, revenueGrowth: [0.5, 0.45, 0.4, 0.35, 0.3], terminalGrowth: 0.06, beta: 0.2 };
    const checks = runChecks(wild, runDcf(wild));
    expect(starRating(checks)).toBeLessThanOrEqual(2);
  });
});

describe("share links", () => {
  it("round-trips inputs and restores preset source notes", () => {
    const edited = { ...APPLE, terminalGrowth: 0.027, revenueGrowth: [0.1, 0.09, 0.08, 0.07, 0.06] };
    const token = encodeInputs(edited);
    expect(token.length).toBeLessThan(2000);
    expect(decodeInputs(token)).toEqual(edited);
  });
  it("rejects garbage", () => {
    expect(decodeInputs("not-a-model")).toBeNull();
  });
});
