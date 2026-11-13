import { describe, expect, it } from "vitest";
import { TENORS, yieldAt, type Curve } from "./curve";

const rates = [0.0431, 0.0425, 0.0415, 0.0398, 0.0381, 0.0379, 0.0385, 0.0398, 0.0412, 0.0448, 0.0461];
const CURVE: Curve = { date: "2026-11-10", points: TENORS.map((t, i) => ({ ...t, rate: rates[i] })) };

describe("yield curve", () => {
  it("uses an exact maturity when it matches", () => {
    expect(yieldAt(CURVE, 0.25)!.rate).toBe(0.0425);
    expect(yieldAt(CURVE, 10)!.how).toMatch(/10-year/);
  });
  it("interpolates between maturities", () => {
    // 4.5 months sits halfway between the 3- and 6-month bills
    const y = yieldAt(CURVE, 0.375)!;
    expect(y.rate).toBeCloseTo((0.0425 + 0.0415) / 2, 6);
    expect(y.how).toMatch(/3-month.*6-month/);
  });
  it("holds flat beyond the ends", () => {
    expect(yieldAt(CURVE, 3 / 365)!.rate).toBe(0.0431);
    expect(yieldAt(CURVE, 40)!.rate).toBe(0.0461);
  });
  it("copes with missing maturities", () => {
    const gappy: Curve = { date: CURVE.date, points: CURVE.points.filter((p) => p.id !== "DGS6MO") };
    expect(yieldAt(gappy, 0.5)!.how).toMatch(/3-month.*1-year/);
  });
});
