import { NextResponse } from "next/server";
import { inputsFromFacts, SecDataError, trimFacts, type CompanyFacts } from "@/lib/sec";
import { fetchRiskFree } from "@/lib/rates";
import { secUserAgent as userAgent, tickerMap } from "@/lib/secFetch";

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

    const [json, rf] = await Promise.all([res.json(), fetchRiskFree()]);
    const facts = trimFacts(json as CompanyFacts);
    const result = inputsFromFacts(facts, ticker, rf);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    if (e instanceof SecDataError) return fail(422, e.message);
    console.error(e);
    return fail(502, "Couldn't reach the SEC right now. Try again in a minute.");
  }
}
