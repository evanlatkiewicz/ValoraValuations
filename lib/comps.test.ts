import { describe, expect, it } from "vitest";
import { median, readComps, type PeerRow } from "./comps";
import { APPLE } from "./companies";
import { runDcf, baseYear } from "./dcf";

const row = (symbol: string, evEbitda: number | null, evSales: number | null = 5, pe: number | null = 25): PeerRow =>
  ({ symbol, name: symbol, marketCap: 1e11, ev: 1e11, evSales, evEbitda, pe });

describe("comps", () => {
  it("takes the median of usable multiples only", () => {
    expect(median([10, null, 30, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([-5, null])).toBeNull(); // negative EBITDA multiples aren't meaningful
  });

  it("values the company at the peer median EV/EBITDA", () => {
    const inputs = { ...APPLE, sharePrice: 300 };
    const r = runDcf(inputs);
    const c = readComps(inputs, r, [row("A", 18), row("B", 22), row("C", 20), row("D", null)]);
    const b = baseYear(inputs);
    expect(c.medianEvEbitda).toBe(20);
    expect(c.ebitda).toBeCloseTo(b.ebit + b.da, 6);
    expect(c.valueAtMedian).toBeCloseTo((20 * (b.ebit + b.da) - inputs.debt + inputs.cash) / inputs.sharesOutstanding, 6);
    expect(c.modelEvEbitda).toBeCloseTo(r.enterpriseValue / (b.ebit + b.da), 6);
  });
});
