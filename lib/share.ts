import { APPLE } from "./companies";
import { isLogoUrl } from "./market";
import { validScenarios } from "./scenarios";
import type { DcfInputs, Source } from "./types";

// A shared model lives entirely in the link, so links work on any host with
// no database and nothing is stored on a server.
//
// Current links: /dcf?m=z<compressed> (older /?m= links forward there). The server can read them, which is what
// lets LinkedIn and others draw a preview card. Older links used /#m=<plain>,
// and those still open.

const VERSION = 1;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toBase64Url(s: string): string {
  return bytesToBase64Url(new TextEncoder().encode(s));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Only the kind of each source travels in the link. Notes for the preloaded
// company are restored from the preset when the link is opened.
function payload(inputs: DcfInputs): string {
  const kinds = Object.fromEntries(Object.entries(inputs.sources).map(([k, s]) => [k, s.kind]));
  return JSON.stringify({ v: VERSION, m: { ...inputs, sources: kinds } });
}

/** Original format, kept so old links keep working. */
export function encodeInputs(inputs: DcfInputs): string {
  return toBase64Url(payload(inputs));
}

/** Compressed token for ?m= links. */
export async function encodeCompact(inputs: DcfInputs): Promise<string> {
  const z = await pipe(new TextEncoder().encode(payload(inputs)), new CompressionStream("deflate-raw"));
  return "z" + bytesToBase64Url(z);
}

/** Reads either token format. Returns null for anything invalid. */
export async function decodeAny(token: string): Promise<DcfInputs | null> {
  if (!token.startsWith("z")) return decodeInputs(token);
  try {
    const raw = await pipe(base64UrlToBytes(token.slice(1)), new DecompressionStream("deflate-raw"));
    if (raw.length > 200_000) return null;
    return fromJson(new TextDecoder().decode(raw));
  } catch {
    return null;
  }
}

/** Builds the full share URL for a model. */
export async function shareUrl(origin: string, inputs: DcfInputs): Promise<string> {
  return `${origin}/dcf?m=${await encodeCompact(inputs)}`;
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
    return fromJson(fromBase64Url(token));
  } catch {
    return null;
  }
}

function fromJson(json: string): DcfInputs | null {
  try {
    const parsed = JSON.parse(json);
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
    if (m.scenarios !== undefined && !validScenarios(m.scenarios)) delete m.scenarios;
    const company = { ...m.company };
    if (company.logo !== undefined && !isLogoUrl(company.logo)) delete company.logo;
    return { ...m, company, sources: restoreSources(m, m.sources as unknown as Record<string, unknown>) };
  } catch {
    return null;
  }
}
