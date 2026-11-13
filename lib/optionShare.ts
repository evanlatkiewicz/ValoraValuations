// Share links for the options tool: /options?o=z<compressed model>.
// Like DCF links, the whole contract lives in the link, so nothing is stored.
import { isLogoUrl } from "./market";
import type { OptionModel } from "./optionModel";
import { base64UrlToBytes, bytesToBase64Url, pipe } from "./share";

const VERSION = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function encodeOption(m: OptionModel): Promise<string> {
  const json = JSON.stringify({ v: VERSION, o: m });
  const z = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return "z" + bytesToBase64Url(z);
}

export async function optionShareUrl(origin: string, m: OptionModel): Promise<string> {
  return `${origin}/options?o=${await encodeOption(m)}`;
}

const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const numOrNull = (x: unknown) => x === null || num(x);

/** Reads a link token. Returns null for anything malformed. */
export async function decodeOption(token: string): Promise<OptionModel | null> {
  if (!token.startsWith("z") || token.length > 20_000) return null;
  try {
    const raw = await pipe(base64UrlToBytes(token.slice(1)), new DecompressionStream("deflate-raw"));
    if (raw.length > 50_000) return null;
    const parsed = JSON.parse(new TextDecoder().decode(raw));
    if (parsed?.v !== VERSION) return null;
    const m = parsed.o as OptionModel;
    const ok =
      typeof m.ticker === "string" && /^[A-Z][A-Z0-9.-]{0,9}$/.test(m.ticker) &&
      typeof m.name === "string" &&
      (m.type === "call" || m.type === "put") &&
      ["S", "K", "sigma", "treasury", "q"].every((k) => num(m[k as keyof OptionModel])) &&
      ["histVol", "histDays", "dps", "marketPrice"].every((k) => numOrNull(m[k as keyof OptionModel])) &&
      [m.priceDate, m.expiry, m.valuationDate].every((d) => typeof d === "string" && DATE.test(d)) &&
      (m.treasuryDate === null || (typeof m.treasuryDate === "string" && DATE.test(m.treasuryDate)));
    if (!ok) return null;
    const sources: Record<string, string> = {};
    for (const [k, v] of Object.entries(m.sources ?? {})) if (typeof v === "string") sources[k] = v.slice(0, 400);
    const out: OptionModel = { ...m, name: m.name.slice(0, 80), sources };
    if (out.logo !== undefined && !isLogoUrl(out.logo)) delete out.logo;
    return out;
  } catch {
    return null;
  }
}
