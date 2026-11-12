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
  const map = new Map(Object.values(json).map((e) => [e.ticker.toUpperCase(), e]));
  tickerCache = { at: Date.now(), map };
  return map;
}
