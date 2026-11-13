// The options tool's model: a contract on a stock, plus the market inputs
// Black-Scholes needs. Turns friendly inputs (dates, Treasury yield) into the
// formula's inputs (years, continuous rate) and runs the sanity checks.

import type { Check, Level } from "./checks";
import { blackScholes, impliedVol, type OptionInputs, type OptionResult, type OptionType } from "./options";

export interface OptionModel {
  ticker: string;
  name: string;
  logo?: string;
  type: OptionType;
  S: number; // share price
  priceDate: string; // YYYY-MM-DD
  K: number; // strike
  expiry: string; // YYYY-MM-DD
  valuationDate: string; // YYYY-MM-DD, usually today
  sigma: number; // volatility used
  histVol: number | null; // one-year historical volatility, if known
  histDays: number | null;
  treasury: number; // Treasury yield for the option's life, as quoted (bond-equivalent)
  treasuryDate: string | null;
  q: number; // dividend yield
  dps: number | null; // annual dividends per share, if known
  marketPrice: number | null; // what the option actually trades for, optional
  sources: Record<string, string>;
}

export const DAY_MS = 86400000;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}

/** Treasury yields are quoted with semiannual compounding; Black-Scholes wants continuous. */
export const continuousRate = (bondYield: number) => 2 * Math.log(1 + bondYield / 2);

export interface OptionRun {
  days: number;
  T: number;
  r: number; // continuous
  inputs: OptionInputs;
  result: OptionResult;
  price: number; // the selected type
  other: number;
  intrinsic: { call: number; put: number };
  breakeven: { call: number; put: number };
  probITM: { call: number; put: number }; // risk-neutral, N(d2) and N(-d2)
  impliedVol: number | null;
  valid: boolean;
}

export function runOption(m: OptionModel): OptionRun {
  const days = Math.max(daysBetween(m.valuationDate, m.expiry), 0);
  const T = Math.max(days, 0.5) / 365; // half a day minimum keeps the math defined on expiration day
  const r = continuousRate(m.treasury);
  const inputs: OptionInputs = { S: m.S, K: m.K, T, r, q: m.q, sigma: m.sigma };
  const valid = m.S > 0 && m.K > 0 && m.sigma > 0 && days > 0;
  const result = blackScholes(inputs);
  const iv =
    m.marketPrice && m.marketPrice > 0 && valid
      ? impliedVol({ S: m.S, K: m.K, T, r, q: m.q }, m.type, m.marketPrice)
      : null;
  return {
    days,
    T,
    r,
    inputs,
    result,
    price: m.type === "call" ? result.call : result.put,
    other: m.type === "call" ? result.put : result.call,
    intrinsic: { call: Math.max(m.S - m.K, 0), put: Math.max(m.K - m.S, 0) },
    breakeven: { call: m.K + result.call, put: m.K - result.put },
    probITM: { call: result.Nd2, put: 1 - result.Nd2 },
    impliedVol: iv,
    valid,
  };
}

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

export function optionChecks(m: OptionModel, o: OptionRun): Check[] {
  const c: Check[] = [];
  const add = (id: string, title: string, level: Level, message: string, fields: string[]) => c.push({ id, title, level, message, fields });

  // Time to expiration
  if (o.days <= 0) add("time", "Expiration", "bad", "The expiration date has passed or is today. Pick a later date.", ["expiry"]);
  else if (o.days < 7) add("time", "Expiration", "warn", `${o.days} days to expiration. Very close to expiration, small changes in the stock swing the price a lot, and the model is less reliable.`, ["expiry"]);
  else add("time", "Expiration", "good", `${o.days} days to expiration (${o.T.toFixed(2)} years).`, ["expiry"]);

  // Volatility level
  const s = m.sigma;
  const lv: Level = s >= 0.1 && s <= 0.8 ? "good" : s >= 0.05 && s <= 1.5 ? "warn" : "bad";
  add("vol", "Volatility", lv,
    lv === "good" ? `${pct(s)} a year is a normal range for a stock.`
      : s < 0.1 ? `${pct(s)} is unusually low for a single stock. Most large companies run 15% to 40%.`
      : `${pct(s)} is very high. That fits a speculative stock or a stock before a big event, but double-check it.`, ["sigma"]);

  // Volatility vs history
  if (m.histVol) {
    const ratio = s / m.histVol;
    const lr: Level = ratio > 0.6 && ratio < 1.6 ? "good" : "warn";
    add("vol-hist", "Volatility vs. history", lr,
      lr === "good" ? `Your volatility is close to the stock's actual ${pct(m.histVol)} over the past year.`
        : `Your volatility is ${ratio > 1 ? "well above" : "well below"} the stock's actual ${pct(m.histVol)} over the past year. That needs a reason, like an earnings report before expiration.`, ["sigma"]);
  }

  // Implied vs historical, when a market price is given
  if (m.marketPrice && m.marketPrice > 0) {
    if (o.impliedVol === null) {
      add("iv", "Market price", "bad", `No volatility produces a ${m.type} price of $${m.marketPrice.toFixed(2)} here. It's below the option's minimum value or above its maximum. Check the price, strike and date.`, ["marketPrice"]);
    } else if (m.histVol) {
      const ratio = o.impliedVol / m.histVol;
      add("iv", "Implied vs. historical volatility", ratio > 0.6 && ratio < 1.6 ? "good" : "warn",
        `The market price implies ${pct(o.impliedVol, 1)} volatility, against ${pct(m.histVol, 1)} historically. ${ratio > 1.25 ? "The market expects bigger moves than the past year." : ratio < 0.8 ? "The market expects calmer trading than the past year." : "The market and history roughly agree."}`, ["marketPrice"]);
    }
  }

  // Moneyness
  const m0 = Math.log(m.K / m.S);
  add("moneyness", "Strike", Math.abs(m0) > 0.5 ? "warn" : "good",
    Math.abs(m0) > 0.5 ? `The strike is far from today's price. Options this far ${m.type === "call" ? (m0 > 0 ? "out of" : "in") : (m0 < 0 ? "out of" : "in")} the money trade rarely, and their prices depend heavily on the volatility you pick.`
      : `The strike is ${pct(Math.abs(m.K / m.S - 1))} ${m.K >= m.S ? "above" : "below"} today's price.`, ["K"]);

  // Dividend yield
  add("div", "Dividend yield", m.q > 0.08 ? "warn" : m.q < 0 ? "bad" : "good",
    m.q > 0.08 ? `${pct(m.q, 1)} is a very high dividend yield. Check it.` : m.q < 0 ? "A dividend yield can't be negative." : `${pct(m.q, 2)} a year, which lowers call values and raises put values.`, ["q"]);

  // Early exercise (American vs European)
  const itmPut = m.type === "put" && m.K > m.S * 1.1;
  const itmCallDiv = m.type === "call" && m.q > 0.02 && m.S > m.K * 1.1;
  add("american", "European vs. American", itmPut || itmCallDiv ? "warn" : "good",
    itmPut || itmCallDiv
      ? `Black-Scholes prices options that can only be exercised at expiration. US stock options can be exercised early, which matters for ${itmPut ? "deep in-the-money puts" : "in-the-money calls on high-dividend stocks"}. The real price may be a bit higher than this.`
      : "Black-Scholes assumes exercise only at expiration. For this contract, the early-exercise right of US options is worth very little.", ["K"]);

  return c;
}

/** Strikes rounded to the increments exchanges usually list. */
export function roundStrike(x: number): number {
  const step = x < 25 ? 0.5 : x < 200 ? 1 : x < 500 ? 5 : 10;
  return Math.round(x / step) * step;
}

/** Monthly options expire on the third Friday of the month. */
export function thirdFriday(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  const firstFri = 1 + ((5 - d.getUTCDay() + 7) % 7);
  return new Date(Date.UTC(year, month0, firstFri + 14)).toISOString().slice(0, 10);
}

/** The monthly expiration closest to `monthsOut` months from `from`. */
export function expiryIn(from: string, monthsOut: number): string {
  const d = new Date(from + "T00:00:00Z");
  let y = d.getUTCFullYear(), mo = d.getUTCMonth() + monthsOut;
  y += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;
  return thirdFriday(y, mo);
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
