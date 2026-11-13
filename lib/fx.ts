// Exchange rates into US dollars, for foreign companies that report in their
// home currency. Twelve Data first, the Federal Reserve's FRED as a backup.
import type { Fx } from "./sec";
import { latestObservation } from "./rates";

// FRED daily series. "usdPer" series are quoted as USD per unit; the rest as units per USD.
const FRED_FX: Record<string, { id: string; usdPer: boolean }> = {
  EUR: { id: "DEXUSEU", usdPer: true },
  GBP: { id: "DEXUSUK", usdPer: true },
  AUD: { id: "DEXUSAL", usdPer: true },
  JPY: { id: "DEXJPUS", usdPer: false },
  TWD: { id: "DEXTAUS", usdPer: false },
  DKK: { id: "DEXDNUS", usdPer: false },
  CHF: { id: "DEXSZUS", usdPer: false },
  CNY: { id: "DEXCHUS", usdPer: false },
  INR: { id: "DEXINUS", usdPer: false },
  CAD: { id: "DEXCAUS", usdPer: false },
  KRW: { id: "DEXKOUS", usdPer: false },
  SEK: { id: "DEXSDUS", usdPer: false },
  NOK: { id: "DEXNOUS", usdPer: false },
  BRL: { id: "DEXBZUS", usdPer: false },
  MXN: { id: "DEXMXUS", usdPer: false },
  HKD: { id: "DEXHKUS", usdPer: false },
};

const today = () => new Date().toISOString().slice(0, 10);

/** Server only. Null when neither source has the currency. */
export async function fetchFx(currency: string): Promise<Fx | null> {
  const c = currency === "RMB" ? "CNY" : currency.toUpperCase();
  if (c === "USD") return { currency, rate: 1, date: today(), source: "no conversion" };

  const td = process.env.TWELVE_DATA_API_KEY;
  if (td) {
    try {
      const res = await fetch(`https://api.twelvedata.com/exchange_rate?symbol=${c}/USD&apikey=${td}`, {
        next: { revalidate: 6 * 3600 },
        signal: AbortSignal.timeout(4000),
      });
      const json = (await res.json()) as { rate?: number; timestamp?: number };
      if (res.ok && typeof json.rate === "number" && json.rate > 0) {
        const date = json.timestamp ? new Date(json.timestamp * 1000).toISOString().slice(0, 10) : today();
        return { currency, rate: json.rate, date, source: "Twelve Data" };
      }
    } catch {
      /* fall through to FRED */
    }
  }

  const fred = process.env.FRED_API_KEY;
  const series = FRED_FX[c];
  if (fred && series) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${fred}&file_type=json&sort_order=desc&limit=10`;
      const res = await fetch(url, { next: { revalidate: 6 * 3600 }, signal: AbortSignal.timeout(4000) });
      const obs = res.ok ? latestObservation(await res.json(), 1e5) : null;
      if (obs && obs.value > 0) {
        return { currency, rate: series.usdPer ? obs.value : 1 / obs.value, date: obs.date, source: "FRED" };
      }
    } catch {
      /* no rate */
    }
  }
  return null;
}
