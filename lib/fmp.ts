// Financial Modeling Prep: peer companies, trading multiples and earnings dates.
// Server only. Set FMP_API_KEY in Vercel. The free plan allows 250 calls a day,
// so every response is cached for a day. The free plan caps `limit` at 5.

const BASE = "https://financialmodelingprep.com/stable";

async function fmp<T>(path: string, seconds = 86400): Promise<T | null> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE}/${path}${sep}apikey=${key}`, { next: { revalidate: seconds }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface PeerEntry {
  symbol: string;
  companyName: string;
  price?: number;
  mktCap?: number;
}
interface EarningsEntry {
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
}

// US-listed common shares only: FMP also suggests foreign listings (002241.SZ) and
// over-the-counter foreign shares, whose five-letter tickers end in F or Y (ASMXF).
const usListed = (s: string) => /^[A-Z]{1,5}(-[A-Z])?$/.test(s) && !/^[A-Z]{4}[FY]$/.test(s);

/**
 * Similar companies by sector and size, with today's market cap. Free for every
 * symbol, unlike FMP's per-company metrics, which the free plan limits to a sample.
 */
export async function fetchPeerList(ticker: string, n: number): Promise<PeerEntry[] | null> {
  const t = ticker.toUpperCase();
  const list = await fmp<PeerEntry[]>(`stock-peers?symbol=${encodeURIComponent(t)}`);
  if (!Array.isArray(list)) return null;
  return list
    .filter((p) => usListed(p.symbol) && p.symbol !== t && (p.mktCap ?? 0) > 1e9)
    .sort((a, b) => (b.mktCap ?? 0) - (a.mktCap ?? 0))
    .slice(0, n);
}

/** The next scheduled earnings report on or after `from` (YYYY-MM-DD), if FMP knows one. */
export async function fetchNextEarnings(ticker: string, from: string): Promise<{ date: string; epsEstimated: number | null } | null> {
  const t = ticker.toUpperCase().replace("-", ".");
  const rows = await fmp<EarningsEntry[]>(`earnings?symbol=${encodeURIComponent(t)}&limit=5`, 6 * 3600);
  if (!Array.isArray(rows)) return null;
  const next = rows
    .filter((r) => typeof r.date === "string" && r.date >= from && r.epsActual === null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return next ? { date: next.date, epsEstimated: next.epsEstimated ?? null } : null;
}
