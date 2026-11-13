// Trading comparables: how similar companies are priced, and what the model's
// company would be worth at their multiples. Pure functions; data comes from lib/fmp.ts.
import { baseYear } from "./dcf";
import type { DcfInputs, DcfResult } from "./types";

export interface PeerRow {
  symbol: string;
  name: string;
  year?: string; // fiscal year the fundamentals come from
  marketCap: number | null; // dollars
  ev: number | null; // dollars
  evSales: number | null;
  evEbitda: number | null;
  pe: number | null;
}

export function median(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface CompsRead {
  medianEvEbitda: number | null;
  medianEvSales: number | null;
  medianPe: number | null;
  /** The model's own EV / base-year EBITDA, comparable to the peers' column. */
  modelEvEbitda: number | null;
  /** Value per share if the company traded at the peer median EV/EBITDA. */
  valueAtMedian: number | null;
  ebitda: number; // base year, $ millions
}

export function readComps(inputs: DcfInputs, result: DcfResult, peers: PeerRow[]): CompsRead {
  const b = baseYear(inputs);
  const ebitda = b.ebit + b.da;
  const medianEvEbitda = median(peers.map((p) => p.evEbitda));
  const valueAtMedian =
    medianEvEbitda !== null && ebitda > 0 && inputs.sharesOutstanding > 0
      ? (medianEvEbitda * ebitda - inputs.debt + inputs.cash) / inputs.sharesOutstanding
      : null;
  return {
    medianEvEbitda,
    medianEvSales: median(peers.map((p) => p.evSales)),
    medianPe: median(peers.map((p) => p.pe)),
    modelEvEbitda: ebitda > 0 && result.enterpriseValue > 0 ? result.enterpriseValue / ebitda : null,
    valueAtMedian,
    ebitda,
  };
}
