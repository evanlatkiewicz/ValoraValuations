import { NextResponse } from "next/server";
import { dividendInfo, tidyName, type CompanyFacts } from "@/lib/sec";
import { secUserAgent, tickerMap } from "@/lib/secFetch";

// Company name and annual dividends per share, for the options tool.
// Works for any SEC filer, including banks. ETFs and foreign companies may
// have no data, which is fine: the tool falls back to no dividend.
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase().replace(".", "-") ?? "";
  const empty = (name: string | null) => NextResponse.json({ name, dps: null, year: null });
  if (!/^[A-Z][A-Z0-9-]{0,9}$/.test(ticker)) return NextResponse.json({ error: "Enter a ticker symbol." }, { status: 400 });
  const ua = secUserAgent();
  if (!ua) return empty(null);
  try {
    const entry = (await tickerMap(ua)).get(ticker);
    if (!entry) return empty(null);
    const name = tidyName(entry.title);
    const cik = String(entry.cik_str).padStart(10, "0");
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { "User-Agent": ua },
      cache: "no-store",
    });
    if (!res.ok) return empty(name);
    const facts = (await res.json()) as CompanyFacts;
    const d = dividendInfo(facts);
    return NextResponse.json(
      { name: tidyName(facts.entityName || entry.title), dps: d?.dps ?? null, year: d?.year ?? null },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch {
    return empty(null);
  }
}
