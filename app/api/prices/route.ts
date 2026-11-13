import { NextResponse } from "next/server";
import { computeBeta, isLogoUrl, range52, type Bar, type DayQuote, type MarketData } from "@/lib/market";

// Daily prices from Twelve Data. One request per ticker (cached for hours),
// plus one shared request for the S&P 500 ETF used to calculate beta.
// Set TWELVE_DATA_API_KEY in Vercel (Settings > Environment Variables).

const BASE = "https://api.twelvedata.com/time_series";
const MARKET_PROXY = "SPY";

class PriceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Raw = { datetime: string; open: string; high: string; low: string; close: string; volume?: string };

async function daily(symbol: string, key: string, size: number, revalidate: number): Promise<Bar[]> {
  return toBars(await series(symbol, key, size, revalidate));
}

function toBars(values: Raw[]): Bar[] {
  return values
    .map((v) => ({ d: v.datetime.slice(0, 10), c: Number(v.close) }))
    .filter((b) => Number.isFinite(b.c) && b.c > 0)
    .reverse(); // oldest first
}

/** Open, high, low, volume and 30-day average volume for the latest day. Values are newest first. */
function dayQuote(values: Raw[]): DayQuote | undefined {
  const [t, y] = values;
  if (!t) return undefined;
  const vols = values.slice(0, 30).map((v) => Number(v.volume)).filter((x) => Number.isFinite(x) && x > 0);
  const n = (x: string | undefined) => (Number.isFinite(Number(x)) ? Number(x) : NaN);
  return {
    date: t.datetime.slice(0, 10),
    open: n(t.open),
    high: n(t.high),
    low: n(t.low),
    close: n(t.close),
    prevClose: y ? n(y.close) : null,
    volume: Number.isFinite(Number(t.volume)) ? Number(t.volume) : null,
    avgVolume: vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null,
  };
}

async function series(symbol: string, key: string, size: number, revalidate: number): Promise<Raw[]> {
  const url = `${BASE}?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${size}&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate } });
  const json = await res.json().catch(() => null);
  if (!json || json.status === "error") {
    const code = json?.code;
    if (code === 429) throw new PriceError(429, "The free price data limit was reached for now. Try again in a minute.");
    if (code === 400 || code === 404) throw new PriceError(404, `No price data found for ${symbol}.`);
    throw new PriceError(502, "Couldn't reach the price data service right now.");
  }
  return (json.values ?? []) as Raw[];
}

async function logo(symbol: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.twelvedata.com/logo?symbol=${encodeURIComponent(symbol)}&apikey=${key}`, {
      next: { revalidate: 30 * 86400 }, // logos rarely change
    });
    const json = await res.json();
    return isLogoUrl(json?.url) ? json.url : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(raw)) {
    return NextResponse.json({ error: "Enter a ticker symbol." }, { status: 400 });
  }
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Price data isn't set up yet. The site owner needs to add TWELVE_DATA_API_KEY." }, { status: 500 });
  }
  const symbol = raw.replace("-", "."); // BRK-B -> BRK.B

  try {
    const [values, spy, logoUrl] = await Promise.all([
      series(symbol, key, 1300, 6 * 3600),
      daily(MARKET_PROXY, key, 600, 12 * 3600).catch(() => [] as Bar[]),
      logo(symbol, key),
    ]);
    const bars = toBars(values);
    if (bars.length < 5) throw new PriceError(404, `No price data found for ${raw}.`);
    const { high, low } = range52(bars);
    const data: MarketData = {
      ticker: raw,
      bars,
      last: bars[bars.length - 1],
      high52: high,
      low52: low,
      beta: spy.length ? computeBeta(bars, spy) : null,
      logo: logoUrl,
      source: "Twelve Data",
      quote: dayQuote(values),
    };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" },
    });
  } catch (e) {
    if (e instanceof PriceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Couldn't reach the price data service right now." }, { status: 502 });
  }
}
