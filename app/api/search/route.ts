import { NextResponse } from "next/server";
import { secUserAgent, tickerMap } from "@/lib/secFetch";
import { tidyName } from "@/lib/sec";
import { rankCompanies, type SearchHit } from "@/lib/search";

let listCache: SearchHit[] | null = null;

// GET /api/search?q=apple → up to 8 { ticker, name } from the SEC's ticker list.
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  if (!q.trim()) return NextResponse.json({ results: [] });
  const ua = secUserAgent();
  if (!ua) return NextResponse.json({ results: [] });
  try {
    if (!listCache) {
      const map = await tickerMap(ua);
      listCache = [...map.values()].map((e) => ({ ticker: e.ticker.toUpperCase(), name: tidyName(e.title) }));
    }
    return NextResponse.json(
      { results: rankCompanies(listCache, q) },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}
