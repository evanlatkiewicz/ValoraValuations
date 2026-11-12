import { APPLE } from "./companies";
import type { DcfInputs, Source } from "./types";

// A shared model lives entirely in the link (after the #), so links work on
// any host with no database, and nothing is stored on a server.

const VERSION = 1;

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Only the kind of each source travels in the link. Notes for the preloaded
// company are restored from the preset when the link is opened.
export function encodeInputs(inputs: DcfInputs): string {
  const kinds = Object.fromEntries(Object.entries(inputs.sources).map(([k, s]) => [k, s.kind]));
  return toBase64Url(JSON.stringify({ v: VERSION, m: { ...inputs, sources: kinds } }));
}

function restoreSources(m: DcfInputs, raw: Record<string, unknown>): DcfInputs["sources"] {
  const preset = m.company?.ticker === APPLE.company.ticker ? APPLE.sources : {};
  const out: DcfInputs["sources"] = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const kind = (typeof v === "string" ? v : (v as { kind?: string })?.kind) as Source["kind"];
    if (!["filing", "market", "assumption", "user"].includes(kind)) continue;
    const orig = preset[k];
    if (orig && orig.kind === kind) out[k] = orig;
    else if (orig) out[k] = { kind, note: `You changed this. Original: ${orig.note}`, url: orig.url };
    else out[k] = { kind };
  }
  return out;
}

export function decodeInputs(token: string): DcfInputs | null {
  try {
    const parsed = JSON.parse(fromBase64Url(token));
    if (parsed?.v !== VERSION) return null;
    const m = parsed.m as DcfInputs;
    const okArrays =
      Array.isArray(m.history) &&
      m.history.length > 0 &&
      Array.isArray(m.revenueGrowth) &&
      m.revenueGrowth.length === 5 &&
      Array.isArray(m.ebitMargin) &&
      m.ebitMargin.length === 5;
    const nums: (keyof DcfInputs)[] = [
      "baseNwc", "taxRate", "daPct", "capexPct", "nwcPct", "sharePrice", "sharesOutstanding",
      "cash", "debt", "riskFreeRate", "beta", "equityRiskPremium", "preTaxCostOfDebt",
      "terminalGrowth", "exitMultiple",
    ];
    const okNums = nums.every((k) => typeof m[k] === "number" && isFinite(m[k] as number));
    if (!okArrays || !okNums || !m.company) return null;
    return { ...m, sources: restoreSources(m, m.sources as unknown as Record<string, unknown>) };
  } catch {
    return null;
  }
}
