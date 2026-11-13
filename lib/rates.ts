// The live risk-free rate: the 10-year Treasury yield (FRED series DGS10).
import { MARKET } from "./companies";

export interface RiskFree {
  rate: number; // decimal, 0.0412 = 4.12%
  date: string | null; // observation date, YYYY-MM-DD; null for the fallback
  source: string;
  live: boolean;
}

export const FALLBACK_RF: RiskFree = { rate: MARKET.riskFreeRate, date: null, source: "Valora default", live: false };

/** Latest valid observation from a FRED observations response. FRED marks holidays with ".". */
export function latestObservation(json: unknown, max = 30): { date: string; value: number } | null {
  const obs = (json as { observations?: { date: string; value: string }[] })?.observations;
  if (!Array.isArray(obs)) return null;
  const valid = obs
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.date) && Number.isFinite(o.value) && o.value > -5 && o.value < max)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return valid[0] ?? null;
}

export function rfNote(rf: RiskFree): string {
  if (!rf.live || !rf.date) return MARKET.riskFreeNote;
  const d = new Date(rf.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `10-year Treasury yield on ${d}, from the Federal Reserve's FRED database.`;
}

const FRED = "https://api.stlouisfed.org/fred/series/observations";

/** Server only. Cached for 6 hours; falls back to Valora's default if FRED is unavailable. */
export async function fetchRiskFree(): Promise<RiskFree> {
  const key = process.env.FRED_API_KEY;
  if (!key) return FALLBACK_RF;
  try {
    const url = `${FRED}?series_id=DGS10&api_key=${key}&file_type=json&sort_order=desc&limit=10`;
    const res = await fetch(url, { next: { revalidate: 6 * 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return FALLBACK_RF;
    const obs = latestObservation(await res.json());
    if (!obs) return FALLBACK_RF;
    return { rate: Math.round(obs.value * 100) / 10000, date: obs.date, source: "FRED (DGS10)", live: true };
  } catch {
    return FALLBACK_RF;
  }
}
