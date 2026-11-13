import { NextResponse } from "next/server";

// Temporary diagnostics. Never returns the key.
export async function GET() {
  const key = process.env.FMP_API_KEY;
  const paths = ["key-metrics-ttm?symbol=MNST", "key-metrics-ttm?symbol=ASML", "key-metrics-ttm?symbol=AVGO", "earnings?symbol=AAPL&limit=8", "key-metrics-ttm?symbol=PEP"];
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    const res = await fetch(`https://financialmodelingprep.com/stable/${p}&apikey=${key}`, { cache: "no-store" });
    out[p] = { status: res.status, body: (await res.text()).slice(0, 400) };
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
