import { describe, expect, it } from "vitest";
import excel from "../verification/options-excel.json";
import { blackScholes, historicalVol, impliedVol, ncdf, payoffAtExpiry, type OptionInputs } from "./options";

const rows = excel as Record<string, Record<string, number>>;
const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("Black-Scholes matches the independent spreadsheet", () => {
  for (const [name, x] of Object.entries(rows)) {
    it(name, () => {
      const r = blackScholes({ S: x.S, K: x.K, T: x.T, r: x.r, q: x.q, sigma: x.sigma });
      near(r.d1, x.d1, 1e-12);
      near(r.d2, x.d2, 1e-12);
      // The normal CDF approximation is good to about 1e-7, so prices agree to well under a hundredth of a cent
      near(r.call, x.call, 1e-4);
      near(r.put, x.put, 1e-4);
      near(r.callGreeks.delta, x.c_delta, 1e-6);
      near(r.putGreeks.delta, x.p_delta, 1e-6);
      near(r.callGreeks.gamma, x.gamma, 1e-9);
      near(r.callGreeks.vega, x.vega, 1e-9);
      near(r.callGreeks.theta, x.c_theta, 1e-6);
      near(r.putGreeks.theta, x.p_theta, 1e-6);
      near(r.callGreeks.rho, x.c_rho, 1e-6);
      near(r.putGreeks.rho, x.p_rho, 1e-6);
    });
  }
});

describe("Black-Scholes properties", () => {
  const base: OptionInputs = { S: 126.18, K: 130, T: 0.25, r: 0.0486, q: 0.011, sigma: 0.24 };

  it("gives the textbook answer (Hull example 15.6)", () => {
    const r = blackScholes({ S: 42, K: 40, T: 0.5, r: 0.1, q: 0, sigma: 0.2 });
    expect(r.call.toFixed(2)).toBe("4.76");
    expect(r.put.toFixed(2)).toBe("0.81");
  });

  it("satisfies put-call parity", () => {
    const r = blackScholes(base);
    near(r.call - r.put, base.S * Math.exp(-base.q * base.T) - base.K * Math.exp(-base.r * base.T), 1e-6);
  });

  it("recovers the volatility from its own price", () => {
    for (const type of ["call", "put"] as const) {
      const price = type === "call" ? blackScholes(base).call : blackScholes(base).put;
      near(impliedVol({ S: base.S, K: base.K, T: base.T, r: base.r, q: base.q }, type, price)!, base.sigma, 1e-7);
    }
  });

  it("returns no implied volatility for impossible prices", () => {
    const i = { S: 100, K: 80, T: 0.5, r: 0.05, q: 0 };
    expect(impliedVol(i, "call", 5)).toBeNull(); // below intrinsic value
    expect(impliedVol(i, "call", 150)).toBeNull(); // above the share price
  });

  it("has an accurate normal CDF", () => {
    near(ncdf(0), 0.5, 1e-7);
    near(ncdf(1.96), 0.9750021048517795, 2e-7);
    near(ncdf(-3), 0.0013498980316301, 2e-7);
  });

  it("annualizes historical volatility", () => {
    // Alternating +1% and -1% daily moves: daily stdev about 1%, annual about 15.9%
    const closes = [100];
    for (let k = 0; k < 252; k++) closes.push(closes[k] * (k % 2 ? 0.99 : 1.01));
    const hv = historicalVol(closes)!;
    near(hv.sigma, 0.01 * Math.sqrt(252), 0.002);
    expect(hv.n).toBe(252);
  });

  it("computes payoff at expiration", () => {
    expect(payoffAtExpiry("call", 100, 5, 120)).toBe(15);
    expect(payoffAtExpiry("put", 100, 5, 120)).toBe(-5);
  });
});
