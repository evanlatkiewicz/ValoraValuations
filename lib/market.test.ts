import { describe, expect, it } from "vitest";
import { computeBeta, range52, weekKey, type Bar } from "./market";

/** Daily bars, weekdays only, starting on a Monday. */
function series(returnsByWeek: number[], start = 100): Bar[] {
  const bars: Bar[] = [];
  let price = start;
  const d = new Date("2024-01-01T00:00:00Z"); // a Monday
  for (const r of returnsByWeek) {
    for (let day = 0; day < 5; day++) {
      if (day === 4) price *= 1 + r; // the week's move lands on Friday
      bars.push({ d: d.toISOString().slice(0, 10), c: price });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    d.setUTCDate(d.getUTCDate() + 2);
  }
  return bars;
}

const marketReturns = Array.from({ length: 110 }, (_, i) => Math.sin(i * 1.7) * 0.03);

describe("beta", () => {
  it("groups dates into Monday weeks", () => {
    expect(weekKey("2026-11-12")).toBe("2026-11-09"); // Thursday
    expect(weekKey("2026-11-09")).toBe("2026-11-09"); // Monday
    expect(weekKey("2026-11-15")).toBe("2026-11-09"); // Sunday
  });

  it("recovers a known beta exactly when the stock moves 1.5x the market", () => {
    const m = series(marketReturns);
    const s = series(marketReturns.map((r) => 1.5 * r));
    const b = computeBeta(s, m)!;
    expect(b.raw).toBeCloseTo(1.5, 8);
    expect(b.adjusted).toBeCloseTo(0.67 * 1.5 + 0.33, 8);
    expect(b.r2).toBeCloseTo(1, 8);
    expect(b.weeks).toBe(104);
  });

  it("gives a beta near zero for a stock unrelated to the market", () => {
    const m = series(marketReturns);
    const s = series(marketReturns.map((_, i) => Math.cos(i * 2.9) * 0.02));
    expect(Math.abs(computeBeta(s, m)!.raw)).toBeLessThan(0.3);
  });

  it("needs enough shared history", () => {
    expect(computeBeta(series(marketReturns.slice(0, 10)), series(marketReturns))).toBeNull();
  });

  it("finds the 52-week range", () => {
    const bars = series(marketReturns);
    const r = range52(bars);
    expect(r.high).toBeGreaterThanOrEqual(r.low);
    expect(r.high).toBeLessThanOrEqual(Math.max(...bars.map((b) => b.c)));
  });
});
