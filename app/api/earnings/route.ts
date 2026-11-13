import { NextResponse } from "next/server";
import { fetchNextEarnings } from "@/lib/fmp";

// GET /api/earnings?ticker=AAPL → the next scheduled earnings report, if one is known.
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return NextResponse.json({ error: "Enter a ticker symbol." }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  const next = await fetchNextEarnings(ticker, today);
  return NextResponse.json({ next }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
