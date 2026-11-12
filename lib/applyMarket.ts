import { fmtDate, type MarketData } from "./market";
import type { DcfInputs } from "./types";

export const betaNote = (m: MarketData) =>
  m.beta
    ? `Calculated from ${m.beta.weeks} weeks of weekly returns against the S&P 500 (SPY): raw beta ${m.beta.raw.toFixed(2)}, adjusted to ${m.beta.adjusted.toFixed(2)} with the standard 0.67 × raw + 0.33 formula.`
    : "";

export function withPrice(inputs: DcfInputs, m: MarketData): DcfInputs {
  return {
    ...inputs,
    sharePrice: Math.round(m.last.c * 100) / 100,
    company: { ...inputs.company, priceDate: fmtDate(m.last.d) },
    sources: { ...inputs.sources, sharePrice: { kind: "market", note: `Last close on ${fmtDate(m.last.d)}, from ${m.source}.` } },
  };
}

export function withBeta(inputs: DcfInputs, m: MarketData): DcfInputs {
  if (!m.beta) return inputs;
  return {
    ...inputs,
    beta: Math.round(m.beta.adjusted * 100) / 100,
    sources: { ...inputs.sources, beta: { kind: "market", note: betaNote(m) } },
  };
}
