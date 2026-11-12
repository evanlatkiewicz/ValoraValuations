import { NextResponse } from "next/server";
import { inputsFromFacts, SecDataError, trimFacts, type CompanyFacts } from "@/lib/sec";

// SEC asks every automated tool to identify itself with a contact email.
// Set SEC_CONTACT_EMAIL in Vercel (Settings > Environment Variables).
function userAgent(): string | null {
  const email = process.env.SEC_CONTACT_EMAIL;
  return email ? `Valora DCF Builder ${email}` : null;
}

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerCache: { at: number; map: Map<string, TickerEntry> } | null = null;

async function tickerMap(ua: string): Promise<Map<string, TickerEntry>> {
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

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase().replace(".", "-") ?? "";
  if (!/^[A-Z][A-Z0-9-]{0,9}$/.test(ticker)) return fail(400, "Enter a ticker symbol, like MSFT or KO.");

  const ua = userAgent();
  if (!ua) return fail(500, "Ticker search isn't set up yet. The site owner needs to add SEC_CONTACT_EMAIL.");

  try {
    const entry = (await tickerMap(ua)).get(ticker);
    if (!entry) return fail(404, `No SEC filer found for ${ticker}. Valora works with US-listed companies that file 10-Ks.`);

    const cik = String(entry.cik_str).padStart(10, "0");
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { "User-Agent": ua },
      cache: "no-store", // full files exceed the data cache limit; responses are cached at the edge instead
    });
    if (res.status === 404) return fail(404, `${entry.title} has no financial data on file with the SEC.`);
    if (!res.ok) return fail(502, `The SEC didn't respond (status ${res.status}). Try again in a minute.`);

    const facts = trimFacts((await res.json()) as CompanyFacts);
    const result = inputsFromFacts(facts, ticker);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    if (e instanceof SecDataError) return fail(422, e.message);
    console.error(e);
    return fail(502, "Couldn't reach the SEC right now. Try again in a minute.");
  }
}
