import { NextResponse } from "next/server";
import { fetchPeers } from "@/lib/peers";

// GET /api/peers?ticker=AAPL → its largest US-listed peers, with multiples from their latest annual reports.
export const maxDuration = 30;
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return NextResponse.json({ error: "Enter a ticker symbol." }, { status: 400 });
  if (!process.env.FMP_API_KEY) return NextResponse.json({ error: "Peer data isn't set up yet." }, { status: 503 });
  const data = await fetchPeers(ticker);
  if (!data || !data.peers.length) return NextResponse.json({ peers: [], selfNetIncome: data?.selfNetIncome ?? null });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } });
}
