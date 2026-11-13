// Ranking for the ticker search box: type a ticker or part of a company name.
export interface SearchHit {
  ticker: string;
  name: string;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Words that add nothing when matching a company name.
const FILLER = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|holdings?|group|the|n ?v|s ?a|ag|se)\b/g;

/**
 * Score every company against the query and return the best few.
 * Exact ticker first, then ticker prefix, then names that start with the
 * query, then names with a word that starts with it, then anything containing it.
 */
export function rankCompanies(list: SearchHit[], query: string, limit = 8): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const qt = query.trim().toUpperCase().replace(/\./g, "-");
  const qn = q.replace(FILLER, " ").replace(/\s+/g, " ").trim() || q;
  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of list) {
    const t = hit.ticker.toUpperCase();
    const n = norm(hit.name);
    let score = 0;
    if (t === qt) score = 1000;
    else if (n === qn || n.replace(FILLER, " ").replace(/\s+/g, " ").trim() === qn) score = 900;
    else if (n.startsWith(qn)) score = 700;
    else if (t.startsWith(qt) && qt.length >= 1) score = 600 - (t.length - qt.length) * 10;
    else if ((" " + n).includes(" " + qn)) score = 500;
    else if (qn.length >= 3 && n.includes(qn)) score = 300;
    if (!score) continue;
    // Prefer the main share class and plain tickers over preferreds and warrants.
    if (t.includes("-")) score -= 50;
    score -= Math.min(t.length, 6);
    scored.push({ hit, score });
  }
  scored.sort((a, b) => b.score - a.score || a.hit.ticker.length - b.hit.ticker.length);
  // One row per company: keep its best-scoring ticker.
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const { hit } of scored) {
    const key = norm(hit.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/** What to load when the person presses Enter without picking a row. */
export function resolveTyped(typed: string, hits: SearchHit[]): string {
  const t = typed.trim().toUpperCase();
  if (!hits.length) return t;
  if (hits.some((h) => h.ticker.toUpperCase() === t)) return t;
  // Short all-letter input that matches nothing exactly: treat it as a ticker.
  if (/^[A-Z.\-]{1,5}$/.test(typed.trim()) && typed.trim() === typed.trim().toUpperCase()) return t;
  return hits[0].ticker.toUpperCase();
}
