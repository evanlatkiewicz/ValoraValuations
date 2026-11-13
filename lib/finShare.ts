// Share links for the bank and insurer model: /financials?f=z<compressed model>.
import type { EquityInputs } from "./equity";
import { isLogoUrl } from "./market";
import { base64UrlToBytes, bytesToBase64Url, pipe } from "./share";

const VERSION = 1;
const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const KINDS = new Set(["bank", "insurer", "reit", "financial"]);
const SOURCE_KINDS = new Set(["filing", "market", "assumption", "user"]);

export async function encodeFin(m: EquityInputs): Promise<string> {
  const z = await pipe(new TextEncoder().encode(JSON.stringify({ v: VERSION, f: m })), new CompressionStream("deflate-raw"));
  return "z" + bytesToBase64Url(z);
}

export async function finShareUrl(origin: string, m: EquityInputs): Promise<string> {
  return `${origin}/financials?f=${await encodeFin(m)}`;
}

export async function decodeFin(token: string): Promise<EquityInputs | null> {
  if (!token.startsWith("z") || token.length > 30_000) return null;
  try {
    const raw = await pipe(base64UrlToBytes(token.slice(1)), new DecompressionStream("deflate-raw"));
    if (raw.length > 80_000) return null;
    const p = JSON.parse(new TextDecoder().decode(raw));
    if (p?.v !== VERSION) return null;
    const m = p.f as EquityInputs;
    const c = m?.company;
    const ok =
      c && typeof c.name === "string" && typeof c.ticker === "string" && c.ticker.length <= 12 && typeof c.baseYearLabel === "string" &&
      KINDS.has(c.kind) &&
      Array.isArray(m.history) && m.history.length >= 1 && m.history.length <= 10 &&
      m.history.every((h) => typeof h.label === "string" && num(h.netIncome) && num(h.bookEquity) && num(h.payouts)) &&
      Array.isArray(m.roe) && m.roe.length === 5 && m.roe.every(num) &&
      ["bookEquity", "longRunRoe", "payoutRatio", "sharePrice", "sharesOutstanding", "riskFreeRate", "beta", "equityRiskPremium", "terminalGrowth"].every((k) =>
        num(m[k as keyof EquityInputs]),
      );
    if (!ok) return null;
    const sources: EquityInputs["sources"] = {};
    for (const [k, s] of Object.entries(m.sources ?? {})) {
      if (s && SOURCE_KINDS.has(s.kind)) {
        sources[k] = {
          kind: s.kind,
          ...(typeof s.note === "string" ? { note: s.note.slice(0, 400) } : {}),
          ...(typeof s.url === "string" && /^https:\/\//.test(s.url) ? { url: s.url.slice(0, 300) } : {}),
        };
      }
    }
    const company = { ...c, name: c.name.slice(0, 120) };
    if (company.logo !== undefined && !isLogoUrl(company.logo)) delete company.logo;
    return { ...m, company, sources };
  } catch {
    return null;
  }
}
