// Server-side helpers for SEC EDGAR: the ticker list and company facts.

// SEC asks every automated tool to identify itself with a contact email.
// Set SEC_CONTACT_EMAIL in Vercel (Settings > Environment Variables).
export function secUserAgent(): string | null {
  const email = process.env.SEC_CONTACT_EMAIL;
  return email ? `Valora DCF Builder ${email}` : null;
}

export interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerCache: { at: number; map: Map<string, TickerEntry> } | null = null;

export async function tickerMap(ua: string): Promise<Map<string, TickerEntry>> {
  if (tickerCache && Date.now() - tickerCache.at < 86400_000) return tickerCache.map;
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": ua },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`SEC ticker list returned ${res.status}`);
  const json = (await res.json()) as Record<string, TickerEntry>;
  // A few tickers appear more than once (a parent and a financing subsidiary).
  // The SEC lists the main company first, so keep the first entry.
  const map = new Map<string, TickerEntry>();
  for (const e of Object.values(json)) if (!map.has(e.ticker.toUpperCase())) map.set(e.ticker.toUpperCase(), e);
  tickerCache = { at: Date.now(), map };
  return map;
}
