// Peer comps, server side. FMP picks the peers and gives their market caps;
// each peer's revenue, EBITDA, debt, cash and net income come from its own SEC
// filings, read exactly the way Valora reads the company being valued.
import type { PeerRow } from "./comps";
import { fetchPeerList } from "./fmp";
import { fetchFx } from "./fx";
import { FALLBACK_RF } from "./rates";
import { inputsFromFacts, netIncomeFromFacts, reportingBook, trimFacts, type CompanyFacts } from "./sec";
import { equityFromFacts } from "./secFin";
import { secUserAgent, tickerMap } from "./secFetch";

async function facts(cik: number, ua: string): Promise<CompanyFacts | null> {
  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`, {
      headers: { "User-Agent": ua },
      cache: "no-store", // too large for the data cache; the route's response is cached at the edge instead
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? trimFacts((await res.json()) as CompanyFacts) : null;
  } catch {
    return null;
  }
}

// FMP's peer lists for a few large companies are mostly foreign listings. When fewer
// than three US-listed peers come back, these fill in, priced with Twelve Data.
const FALLBACK: Record<string, string[]> = {
  AAPL: ["MSFT", "GOOGL", "DELL", "HPQ", "SONY"],
  MSFT: ["AAPL", "GOOGL", "ORCL", "CRM", "ADBE"],
  GOOGL: ["META", "MSFT", "AMZN", "AAPL", "NFLX"],
  GOOG: ["META", "MSFT", "AMZN", "AAPL", "NFLX"],
  META: ["GOOGL", "SNAP", "PINS", "MSFT", "AMZN"],
  AMZN: ["WMT", "COST", "MSFT", "GOOGL", "EBAY"],
  TSLA: ["GM", "F", "TM", "RIVN", "LCID"],
  JPM: ["BAC", "WFC", "C", "GS", "MS"],
  BAC: ["JPM", "WFC", "C", "USB", "PNC"],
  WFC: ["JPM", "BAC", "C", "USB", "PNC"],
  C: ["JPM", "BAC", "WFC", "GS", "MS"],
  GS: ["MS", "JPM", "BAC", "C", "SCHW"],
  MS: ["GS", "JPM", "SCHW", "BAC", "C"],
};

async function twelveDataPrices(symbols: string[]): Promise<Record<string, number>> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key || !symbols.length) return {};
  try {
    const res = await fetch(`https://api.twelvedata.com/price?symbol=${symbols.join(",")}&apikey=${key}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    const j = (await res.json()) as Record<string, unknown>;
    // One symbol comes back as { price }, several as { SYM: { price } }
    if (symbols.length === 1) return typeof j.price === "string" ? { [symbols[0]]: Number(j.price) } : {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(j)) {
      const p = (v as { price?: string } | null)?.price;
      if (p) out[k] = Number(p);
    }
    return out;
  } catch {
    return {};
  }
}

export interface PeersResult {
  peers: PeerRow[];
  /** The company's own latest net income, $ millions, so the page can show its P/E at today's price. */
  selfNetIncome: number | null;
}

export async function fetchPeers(ticker: string, want = 5): Promise<PeersResult | null> {
  const ua = secUserAgent();
  if (!ua) return null;
  let list = await fetchPeerList(ticker, want + 3); // a few spares: banks and odd filers drop out
  if (!list) return null;
  const extra = FALLBACK[ticker.toUpperCase()];
  if (list.length < 3 && extra) {
    const have = new Set(list.map((p) => p.symbol));
    const add = extra.filter((s) => !have.has(s)).slice(0, want - list.length);
    const prices = await twelveDataPrices(add);
    // Market cap is filled in below from the filing's share count; mark these with their price.
    list = [...list, ...add.filter((s) => prices[s] > 0).map((s) => ({ symbol: s, companyName: "", price: prices[s], mktCap: -1 }))];
  }
  const map = await tickerMap(ua);

  const read = async (symbol: string): Promise<{ f: CompanyFacts; fx: Awaited<ReturnType<typeof fetchFx>> } | null> => {
    const entry = map.get(symbol.toUpperCase());
    if (!entry) return null;
    const f = await facts(entry.cik_str, ua);
    if (!f) return null;
    const book = reportingBook(f);
    const fx = book && book.unit !== "USD" ? await fetchFx(book.unit) : null;
    return { f, fx };
  };

  const [self, ...rows] = await Promise.all([
    read(ticker),
    ...list.map(async (p): Promise<PeerRow | null> => {
      const got = await read(p.symbol);
      if (!got || !p.mktCap) return null;
      try {
        const { inputs } = inputsFromFacts(got.f, p.symbol, FALLBACK_RF, got.fx);
        const b = inputs.history.at(-1)!;
        // $ millions, like the filings. Fallback peers have a price but no market cap yet.
        const mcap = p.mktCap > 0 ? p.mktCap / 1e6 : (p.price ?? 0) * inputs.sharesOutstanding;
        if (!(mcap > 0)) return null;
        const ev = mcap + inputs.debt - inputs.cash;
        const ebitda = b.ebit + b.da;
        const ni = netIncomeFromFacts(got.f, got.fx);
        return {
          symbol: p.symbol,
          name: p.companyName || inputs.company.name,
          year: b.label,
          marketCap: mcap * 1e6,
          ev: ev * 1e6,
          evSales: b.revenue > 0 ? ev / b.revenue : null,
          evEbitda: ebitda > 0 ? ev / ebitda : null,
          pe: ni && ni > 0 ? mcap / ni : null,
        };
      } catch {
        // Banks, insurers and REITs: price to book and P/E from their equity and earnings
        try {
          const { inputs: e } = equityFromFacts(got.f, p.symbol, FALLBACK_RF, got.fx);
          const b = e.history.at(-1)!;
          const mcap = p.mktCap > 0 ? p.mktCap / 1e6 : (p.price ?? 0) * e.sharesOutstanding;
          if (!(mcap > 0) || !(e.bookEquity > 0)) return null;
          return {
            symbol: p.symbol,
            name: p.companyName || e.company.name,
            year: b.label,
            marketCap: mcap * 1e6,
            ev: null,
            evSales: null,
            evEbitda: null,
            pe: b.netIncome > 0 ? mcap / b.netIncome : null,
            pb: mcap / e.bookEquity,
          };
        } catch {
          return null;
        }
      }
    }),
  ]);
  return {
    peers: rows.filter((r): r is PeerRow => r !== null).slice(0, want),
    selfNetIncome: self ? netIncomeFromFacts(self.f, self.fx) : null,
  };
}
