// Price history helpers: weekly returns, beta, and the 52-week range.
// Pure functions so they can be tested without a data provider.

export interface Bar {
  d: string; // YYYY-MM-DD
  c: number; // close
}

export interface Beta {
  raw: number;
  adjusted: number; // Blume adjustment: 0.67 × raw + 0.33
  weeks: number;
  r2: number;
}

/** The latest trading day, like a brokerage app's stats panel. */
export interface DayQuote {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number | null;
  volume: number | null;
  avgVolume: number | null; // 30 trading days
}

export interface MarketData {
  ticker: string;
  bars: Bar[]; // oldest first, daily closes
  last: Bar;
  high52: number;
  low52: number;
  beta: Beta | null;
  logo: string | null;
  source: string;
  quote?: DayQuote; // absent in responses cached before it existed
}

/** Only logos from the data provider are trusted (they're drawn on the server too). */
export function isLogoUrl(u: unknown): u is string {
  return typeof u === "string" && /^https:\/\/api\.twelvedata\.com\/logo\/[A-Za-z0-9.-]+$/.test(u);
}

/** Monday of the week a date falls in, as YYYY-MM-DD (UTC). */
export function weekKey(d: string): string {
  const t = new Date(d + "T00:00:00Z");
  const dow = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

/** Last close of each week, keyed by the week's Monday. */
export function weeklyCloses(bars: Bar[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of bars) out.set(weekKey(b.d), b.c); // later bars overwrite earlier ones
  return out;
}

/**
 * Beta from weekly returns over the most recent `weeks` weeks both series
 * share. Raw beta = cov(stock, market) / var(market).
 */
export function computeBeta(stock: Bar[], market: Bar[], weeks = 104): Beta | null {
  const s = weeklyCloses(stock);
  const m = weeklyCloses(market);
  const keys = [...s.keys()].filter((k) => m.has(k)).sort();
  if (keys.length < 30) return null;
  const use = keys.slice(-(weeks + 1));
  const rs: number[] = [];
  const rm: number[] = [];
  for (let i = 1; i < use.length; i++) {
    rs.push(s.get(use[i])! / s.get(use[i - 1])! - 1);
    rm.push(m.get(use[i])! / m.get(use[i - 1])! - 1);
  }
  const n = rs.length;
  const ms = rs.reduce((a, b) => a + b, 0) / n;
  const mm = rm.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varM = 0, varS = 0;
  for (let i = 0; i < n; i++) {
    cov += (rs[i] - ms) * (rm[i] - mm);
    varM += (rm[i] - mm) ** 2;
    varS += (rs[i] - ms) ** 2;
  }
  if (varM === 0) return null;
  const raw = cov / varM;
  const r2 = varS === 0 ? 0 : (cov * cov) / (varM * varS);
  return { raw, adjusted: 0.67 * raw + 0.33, weeks: n, r2 };
}

export function range52(bars: Bar[]): { high: number; low: number } {
  const last = bars[bars.length - 1];
  const cutoff = new Date(last.d + "T00:00:00Z");
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const from = cutoff.toISOString().slice(0, 10);
  const year = bars.filter((b) => b.d > from);
  return { high: Math.max(...year.map((b) => b.c)), low: Math.min(...year.map((b) => b.c)) };
}

export function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
