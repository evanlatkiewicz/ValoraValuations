// Turns a model into the short summary that the link preview card shows.
import { runChecks, starRating } from "./checks";
import { runDcf } from "./dcf";
import { analyze } from "./scenarios";
import type { DcfInputs } from "./types";

export interface CardSummary {
  name: string;
  ticker: string;
  year: string;
  value: number;
  price: number;
  stars: number;
  warn: boolean; // the model burns cash forever, so the value isn't meaningful
  logo: string | null; // logo domain, like "apple.com"
  range: { bear: number; bull: number; weighted: number } | null;
}

const LOGO_PREFIX = "https://api.twelvedata.com/logo/";
export const logoUrlFor = (domain: string | null) =>
  domain && /^[A-Za-z0-9.-]{3,80}$/.test(domain) ? LOGO_PREFIX + domain : null;

export function summarize(inputs: DcfInputs): CardSummary | null {
  if (!(inputs.sharePrice > 0 && inputs.sharesOutstanding > 0)) return null;
  const r = runDcf(inputs);
  if (!Number.isFinite(r.impliedPrice)) return null;
  const checks = runChecks(inputs, r);
  const a = analyze(inputs);
  const range = a.valid ? { bear: a.cases.bear.value, bull: a.cases.bull.value, weighted: a.expected } : null;
  return {
    range,
    name: (inputs.company.name || "Untitled company").slice(0, 48),
    ticker: inputs.company.ticker.slice(0, 10),
    year: inputs.company.baseYearLabel.slice(0, 10),
    value: r.impliedPrice,
    price: inputs.sharePrice,
    stars: starRating(checks),
    warn: r.years[4].ufcf <= 0 || r.enterpriseValue <= 0,
    logo: inputs.company.logo?.startsWith(LOGO_PREFIX) ? inputs.company.logo.slice(LOGO_PREFIX.length) : null,
  };
}

/** Query string for /og. Kept short so it fits comfortably in a meta tag. */
export function cardQuery(s: CardSummary): string {
  const q = new URLSearchParams({
    n: s.name,
    t: s.ticker,
    y: s.year,
    v: s.value.toFixed(2),
    p: s.price.toFixed(2),
    s: String(s.stars),
  });
  if (s.warn) q.set("w", "1");
  if (s.logo) q.set("l", s.logo);
  if (s.range) q.set("r", [s.range.bear, s.range.bull, s.range.weighted].map((x) => x.toFixed(2)).join("_"));
  return q.toString();
}

export function readCard(q: URLSearchParams): CardSummary | null {
  const value = Number(q.get("v"));
  const price = Number(q.get("p"));
  const stars = Number(q.get("s"));
  if (!q.get("n") || !Number.isFinite(value) || !Number.isFinite(price) || !(price > 0)) return null;
  return {
    name: q.get("n")!.slice(0, 48),
    ticker: (q.get("t") ?? "").slice(0, 10),
    year: (q.get("y") ?? "").slice(0, 10),
    value,
    price,
    stars: Number.isFinite(stars) ? Math.min(5, Math.max(0, stars)) : 0,
    warn: q.get("w") === "1",
    logo: logoUrlFor(q.get("l")) ? q.get("l") : null,
    range: (() => {
      const p = (q.get("r") ?? "").split("_").map(Number);
      return p.length === 3 && p.every(Number.isFinite) ? { bear: p[0], bull: p[1], weighted: p[2] } : null;
    })(),
  };
}
