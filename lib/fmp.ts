// Financial Modeling Prep: peer companies, trading multiples and earnings dates.
// Server only. Set FMP_API_KEY in Vercel. The free plan allows 250 calls a day,
// so every response is cached for a day and each company costs one call.
import type { PeerRow } from "./comps";

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

interface KeyMetricsTtm {
  symbol: string;
  marketCap?: number;
  enterpriseValueTTM?: number;
  evToSalesTTM?: number;
  evToEBITDATTM?: number;
  earningsYieldTTM?: number;
}
interface PeerEntry {
  symbol: string;
  companyName: string;
  mktCap?: number;
}
interface EarningsEntry {
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
}

const toRow = (symbol: string, name: string, k: KeyMetricsTtm | undefined): PeerRow => ({
  symbol,
  name,
  marketCap: k?.marketCap ?? null,
  ev: k?.enterpriseValueTTM ?? null,
  evSales: k?.evToSalesTTM ?? null,
  evEbitda: k?.evToEBITDATTM ?? null,
  pe: k?.earningsYieldTTM && k.earningsYieldTTM > 0 ? 1 / k.earningsYieldTTM : null,
});

// US-listed common shares only: FMP also suggests foreign listings (002241.SZ) and
// over-the-counter foreign shares, whose five-letter tickers end in F or Y (ASMXF).
const usListed = (s: string) => /^[A-Z]{1,5}$/.test(s) && !/^[A-Z]{4}[FY]$/.test(s);

/** The company's own multiples plus up to `n` of its largest US-listed peers. */
export async function fetchPeers(ticker: string, n = 5): Promise<{ self: PeerRow | null; peers: PeerRow[] } | null> {
  const t = ticker.toUpperCase().replace("-", ".");
  const list = await fmp<PeerEntry[]>(`stock-peers?symbol=${encodeURIComponent(t)}`);
  if (!Array.isArray(list)) return null;
  const chosen = list
    .filter((p) => usListed(p.symbol) && p.symbol !== t && (p.mktCap ?? 0) > 1e9)
    .sort((a, b) => (b.mktCap ?? 0) - (a.mktCap ?? 0))
    .slice(0, n);
  const metrics = await Promise.all([t, ...chosen.map((p) => p.symbol)].map((s) => fmp<KeyMetricsTtm[]>(`key-metrics-ttm?symbol=${s}`)));
  const self = Array.isArray(metrics[0]) && metrics[0][0] ? toRow(t, t, metrics[0][0]) : null;
  const peers = chosen.map((p, i) => toRow(p.symbol, p.companyName, Array.isArray(metrics[i + 1]) ? metrics[i + 1]![0] : undefined));
  return { self, peers };
}

/** The next scheduled earnings report on or after `from` (YYYY-MM-DD), if FMP knows one. */
export async function fetchNextEarnings(ticker: string, from: string): Promise<{ date: string; epsEstimated: number | null } | null> {
  const t = ticker.toUpperCase().replace("-", ".");
  const rows = await fmp<EarningsEntry[]>(`earnings?symbol=${encodeURIComponent(t)}&limit=8`, 6 * 3600);
  if (!Array.isArray(rows)) return null;
  const next = rows
    .filter((r) => typeof r.date === "string" && r.date >= from && r.epsActual === null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return next ? { date: next.date, epsEstimated: next.epsEstimated ?? null } : null;
}
