// Black-Scholes-Merton for European options on a stock paying a continuous
// dividend yield. All rates and volatilities are annual decimals; time is in
// years.

export type OptionType = "call" | "put";

export interface OptionInputs {
  S: number; // share price
  K: number; // strike
  T: number; // years to expiration
  r: number; // risk-free rate, continuously compounded
  q: number; // dividend yield
  sigma: number; // volatility
}

export interface Greeks {
  delta: number;
  gamma: number;
  vega: number; // per 1 point (0.01) of volatility
  theta: number; // per calendar day
  rho: number; // per 1 point (0.01) of interest rate
}

export interface OptionResult {
  d1: number;
  d2: number;
  Nd1: number;
  Nd2: number;
  call: number;
  put: number;
  callGreeks: Greeks;
  putGreeks: Greeks;
  /** Parts of the formula, for the step-by-step view */
  discountedS: number; // S e^(-qT)
  discountedK: number; // K e^(-rT)
}

/** Standard normal density. */
export function npdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution. Uses the complementary error
 * function with a Chebyshev fit (Numerical Recipes erfc), accurate to about
 * 1e-7 everywhere, which is plenty for prices quoted in cents.
 */
export function ncdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
        t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? 1 - r / 2 : r / 2;
}

export function blackScholes(i: OptionInputs): OptionResult {
  const { S, K, T, r, q, sigma } = i;
  const sqrtT = Math.sqrt(T);
  const vsT = sigma * sqrtT;
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vsT;
  const d2 = d1 - vsT;
  const eqT = Math.exp(-q * T);
  const erT = Math.exp(-r * T);
  const Nd1 = ncdf(d1), Nd2 = ncdf(d2), Nmd1 = ncdf(-d1), Nmd2 = ncdf(-d2);
  const call = S * eqT * Nd1 - K * erT * Nd2;
  const put = K * erT * Nmd2 - S * eqT * Nmd1;
  const pd1 = npdf(d1);

  const gamma = (eqT * pd1) / (S * vsT);
  const vega = (S * eqT * pd1 * sqrtT) / 100;
  const thetaCallYr = -(S * eqT * pd1 * sigma) / (2 * sqrtT) - r * K * erT * Nd2 + q * S * eqT * Nd1;
  const thetaPutYr = -(S * eqT * pd1 * sigma) / (2 * sqrtT) + r * K * erT * Nmd2 - q * S * eqT * Nmd1;

  return {
    d1, d2, Nd1, Nd2, call, put,
    callGreeks: { delta: eqT * Nd1, gamma, vega, theta: thetaCallYr / 365, rho: (K * T * erT * Nd2) / 100 },
    putGreeks: { delta: -eqT * Nmd1, gamma, vega, theta: thetaPutYr / 365, rho: (-K * T * erT * Nmd2) / 100 },
    discountedS: S * eqT,
    discountedK: K * erT,
  };
}

export const priceOf = (i: OptionInputs, type: OptionType) => (type === "call" ? blackScholes(i).call : blackScholes(i).put);

/**
 * Implied volatility: the sigma that makes the model price equal a market
 * price. Price rises with sigma, so bisection always converges when a
 * solution exists. Returns null if the price is outside what any volatility
 * could produce (below intrinsic value, or above the stock/strike bound).
 */
export function impliedVol(i: Omit<OptionInputs, "sigma">, type: OptionType, market: number): number | null {
  const f = (s: number) => priceOf({ ...i, sigma: s }, type) - market;
  let lo = 1e-4, hi = 5;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

/** Annualized volatility of daily log returns over the last `days` trading days. */
export function historicalVol(closes: number[], days = 252): { sigma: number; n: number } | null {
  const c = closes.slice(-(days + 1));
  if (c.length < 21) return null;
  const rets: number[] = [];
  for (let k = 1; k < c.length; k++) rets.push(Math.log(c[k] / c[k - 1]));
  const n = rets.length;
  const mean = rets.reduce((a, b) => a + b, 0) / n;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { sigma: Math.sqrt(variance * 252), n };
}

/** Profit or loss per share at expiration for someone who bought the option at `premium`. */
export function payoffAtExpiry(type: OptionType, K: number, premium: number, ST: number): number {
  return (type === "call" ? Math.max(ST - K, 0) : Math.max(K - ST, 0)) - premium;
}

/** Continuously compounded version of an annually compounded rate, for the r input. */
export const toContinuous = (annual: number) => Math.log(1 + annual);
