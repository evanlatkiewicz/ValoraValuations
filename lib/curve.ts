// The Treasury yield curve: yields for maturities from one month to 30 years,
// from the Federal Reserve's FRED database. An option should be discounted at
// the rate for its own life, so a 3-month option uses the 3-month bill, not the
// 10-year note. Pure functions here; fetchCurve is server only.
import { latestObservation } from "./rates";

export interface CurvePoint {
  id: string; // FRED series
  label: string; // "3-month"
  short: string; // "3M", for chart axes
  years: number;
  rate: number; // decimal, bond-equivalent yield as quoted
}

export interface Curve {
  date: string; // most recent observation date across the curve
  points: CurvePoint[]; // shortest maturity first
}

export const TENORS: Omit<CurvePoint, "rate">[] = [
  { id: "DGS1MO", label: "1-month", short: "1M", years: 1 / 12 },
  { id: "DGS3MO", label: "3-month", short: "3M", years: 0.25 },
  { id: "DGS6MO", label: "6-month", short: "6M", years: 0.5 },
  { id: "DGS1", label: "1-year", short: "1Y", years: 1 },
  { id: "DGS2", label: "2-year", short: "2Y", years: 2 },
  { id: "DGS3", label: "3-year", short: "3Y", years: 3 },
  { id: "DGS5", label: "5-year", short: "5Y", years: 5 },
  { id: "DGS7", label: "7-year", short: "7Y", years: 7 },
  { id: "DGS10", label: "10-year", short: "10Y", years: 10 },
  { id: "DGS20", label: "20-year", short: "20Y", years: 20 },
  { id: "DGS30", label: "30-year", short: "30Y", years: 30 },
];

export interface CurveYield {
  rate: number;
  /** Plain-English source, e.g. "Interpolated between the 3-month (4.21%) and 6-month (4.15%) yields". */
  how: string;
}

const pct2 = (x: number) => `${(x * 100).toFixed(2)}%`;

/** Yield for a maturity in years, by straight-line interpolation between the two nearest points. */
export function yieldAt(curve: Curve, years: number): CurveYield | null {
  const p = curve.points;
  if (!p.length) return null;
  if (years <= p[0].years) return { rate: p[0].rate, how: `The ${p[0].label} yield (${pct2(p[0].rate)}), the shortest on the curve` };
  const last = p[p.length - 1];
  if (years >= last.years) return { rate: last.rate, how: `The ${last.label} yield (${pct2(last.rate)}), the longest on the curve` };
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    if (years > b.years) continue;
    if (Math.abs(years - b.years) < 1 / 365) return { rate: b.rate, how: `The ${b.label} yield (${pct2(b.rate)})` };
    const w = (years - a.years) / (b.years - a.years);
    const rate = Math.round((a.rate + w * (b.rate - a.rate)) * 1e6) / 1e6;
    return { rate, how: `Interpolated between the ${a.label} (${pct2(a.rate)}) and ${b.label} (${pct2(b.rate)}) yields` };
  }
  return null;
}

/** Server only. Null if FRED isn't set up or too few maturities came back. Cached for 6 hours. */
export async function fetchCurve(): Promise<Curve | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  const got = await Promise.all(
    TENORS.map(async (t) => {
      try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${t.id}&api_key=${key}&file_type=json&sort_order=desc&limit=10`;
        const res = await fetch(url, { next: { revalidate: 6 * 3600 }, signal: AbortSignal.timeout(4000) });
        const obs = res.ok ? latestObservation(await res.json()) : null;
        return obs ? { point: { ...t, rate: Math.round(obs.value * 100) / 10000 }, date: obs.date } : null;
      } catch {
        return null;
      }
    }),
  );
  const ok = got.filter((g): g is NonNullable<typeof g> => g !== null);
  if (ok.length < 6) return null;
  return { date: ok.map((g) => g.date).sort().at(-1)!, points: ok.map((g) => g.point) };
}

/** What /api/rates returns: the 10-year rate the DCF uses, plus the full curve when available. */
export type Rates = import("./rates").RiskFree & { curve?: Curve | null };
