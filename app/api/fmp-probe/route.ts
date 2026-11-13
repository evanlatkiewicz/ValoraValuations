import { NextResponse } from "next/server";

// Temporary: shows which FMP endpoints the key can use and their field names. Never returns the key.
export async function GET() {
  const key = process.env.FMP_API_KEY;
  if (!key) return NextResponse.json({ error: "no FMP_API_KEY" });
  const paths = [
    "stock-peers?symbol=AAPL",
    "key-metrics-ttm?symbol=AAPL",
    "ratios-ttm?symbol=AAPL",
    "profile?symbol=AAPL",
    "quote?symbol=AAPL",
    "earnings?symbol=AAPL&limit=4",
    "key-metrics-ttm?symbol=MSFT",
    "stock-peers?symbol=ASML",
    "key-metrics-ttm?symbol=KO",
  ];
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const res = await fetch(`https://financialmodelingprep.com/stable/${p}&apikey=${key}`, { cache: "no-store" });
      const text = await res.text();
      let body: unknown = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        body = Array.isArray(j) ? { count: j.length, first: j[0], second: j[1] } : j;
      } catch {}
      out[p] = { status: res.status, body };
    } catch (e) {
      out[p] = { error: String(e) };
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
