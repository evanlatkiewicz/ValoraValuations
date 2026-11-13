// Peer comps, server side. FMP picks the peers and gives their market caps;
// each peer's revenue, EBITDA, debt, cash and net income come from its own SEC
// filings, read exactly the way Valora reads the company being valued.
import type { PeerRow } from "./comps";
import { fetchPeerList } from "./fmp";
import { fetchFx } from "./fx";
import { FALLBACK_RF } from "./rates";
import { inputsFromFacts, netIncomeFromFacts, reportingBook, trimFacts, type CompanyFacts } from "./sec";
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

export interface PeersResult {
  peers: PeerRow[];
  /** The company's own latest net income, $ millions, so the page can show its P/E at today's price. */
  selfNetIncome: number | null;
}

export async function fetchPeers(ticker: string, want = 5): Promise<PeersResult | null> {
  const ua = secUserAgent();
  if (!ua) return null;
  const list = await fetchPeerList(ticker, want + 3); // a few spares: banks and odd filers drop out
  if (!list) return null;
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
        const mcap = p.mktCap / 1e6; // $ millions, like the filings
        const ev = mcap + inputs.debt - inputs.cash;
        const ebitda = b.ebit + b.da;
        const ni = netIncomeFromFacts(got.f, got.fx);
        return {
          symbol: p.symbol,
          name: p.companyName,
          year: b.label,
          marketCap: p.mktCap,
          ev: ev * 1e6,
          evSales: b.revenue > 0 ? ev / b.revenue : null,
          evEbitda: ebitda > 0 ? ev / ebitda : null,
          pe: ni && ni > 0 ? mcap / ni : null,
        };
      } catch {
        return null; // banks and companies without operating income
      }
    }),
  ]);
  return {
    peers: rows.filter((r): r is PeerRow => r !== null).slice(0, want),
    selfNetIncome: self ? netIncomeFromFacts(self.f, self.fx) : null,
  };
}
