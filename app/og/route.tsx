import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { logoUrlFor, readCard, readOptionCard, type OptionCard } from "@/lib/og";

// The preview image LinkedIn, Slack, iMessage and others show for a link.
export const runtime = "nodejs";

const PAPER = "#eef1e8";
const SHEET = "#f7f9f3";
const INK = "#18201c";
const SOFT = "#4a5650";
const FAINT = "#7a857e";
const RULE = "#b7c6ae";
const GREEN = "#2f5d46";
const RED = "#b0281f";

let fonts: { name: string; data: Buffer; weight: 400 | 600 | 800 }[] | null = null;
async function loadFonts() {
  if (fonts) return fonts;
  const dir = join(process.cwd(), "assets", "fonts");
  const [r, b, m] = await Promise.all([
    readFile(join(dir, "schibsted-grotesk-latin-400-normal.woff")),
    readFile(join(dir, "schibsted-grotesk-latin-800-normal.woff")),
    readFile(join(dir, "ibm-plex-mono-latin-600-normal.woff")),
  ]);
  fonts = [
    { name: "Schibsted", data: r, weight: 400 },
    { name: "Schibsted", data: b, weight: 800 },
    { name: "Plex Mono", data: m, weight: 600 },
  ];
  return fonts;
}

/** Fetch the company logo and inline it, so a slow logo can't break the card. */
async function logoData(domain: string | null): Promise<string | null> {
  const url = logoUrlFor(domain);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), next: { revalidate: 30 * 86400 } });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!res.ok || !/^image\/(png|jpe?g)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 300_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Mark({ size }: { size: number }) {
  const bars = [1, 0.82, 0.67, 0.55, 0.45];
  return (
    <svg width={size} height={size} viewBox="0 0 26 26">
      <rect x="0.75" y="0.75" width="24.5" height="24.5" rx="2" fill={SHEET} stroke={INK} strokeWidth="1.5" />
      {bars.map((h, i) => (
        <rect key={i} x={4 + i * 3.8} y={21 - 16 * h} width="2.4" height={16 * h} fill={i === 0 ? GREEN : INK} />
      ))}
    </svg>
  );
}

function Brand({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Mark size={size} />
      <div style={{ fontSize: size * 0.85, fontWeight: 800, letterSpacing: -1.2 }}>Valora</div>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const d = "M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z";
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} width="34" height="34" viewBox="0 0 20 20">
            <defs>
              <clipPath id={`c${i}`}>
                <rect x="0" y="0" width={20 * fill} height="20" />
              </clipPath>
            </defs>
            <path d={d} fill="none" stroke={INK} strokeWidth="1.2" />
            <path d={d} fill={INK} clipPath={`url(#c${i})`} />
          </svg>
        );
      })}
    </div>
  );
}

function Footer({ host, note }: { host: string; note: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 64px", borderTop: `1.5px solid ${RULE}`, fontSize: 22, color: SOFT }}>
      <div style={{ display: "flex" }}>{note}</div>
      <div style={{ display: "flex", fontFamily: "Plex Mono", color: INK }}>{host}</div>
    </div>
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? url.host;
  const opts = { width: 1200, height: 630, fonts: await loadFonts() };
  const optCard = readOptionCard(url.searchParams);
  if (optCard) return new ImageResponse(<OptionImage card={optCard} logo={await logoData(optCard.logo)} host={host} />, opts);
  const card = readCard(url.searchParams);

  if (!card) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Schibsted", color: INK }}>
          <div style={{ display: "flex", padding: "52px 64px 0" }}>
            <Brand size={54} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 64px", gap: 22 }}>
            <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, maxWidth: 1000 }}>
              Valuation tools for students, built on live market data.
            </div>
            <div style={{ fontSize: 30, color: SOFT, maxWidth: 940, lineHeight: 1.35 }}>
              Value companies from their SEC filings and price options with Black-Scholes, one assumption at a time.
            </div>
          </div>
          <Footer host={host} note="Free to use, no sign-up" />
        </div>
      ),
      opts,
    );
  }

  const logo = await logoData(card.logo);
  const upside = card.value / card.price - 1;
  const meta = [card.ticker, card.year ? `${card.year} filing` : ""].filter(Boolean).join("   ");
  const initial = (card.name.trim()[0] ?? "?").toUpperCase();

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Schibsted", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "48px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={104} height={104} style={{ borderRadius: 22, border: `2px solid ${RULE}`, background: "#ffffff", padding: 12, objectFit: "contain" }} alt="" />
            ) : (
              <div style={{ width: 104, height: 104, borderRadius: 22, background: INK, color: SHEET, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, fontWeight: 800 }}>
                {initial}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
              <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -2, lineHeight: 1.04 }}>{card.name}</div>
              {meta && <div style={{ fontSize: 24, color: FAINT, fontFamily: "Plex Mono", marginTop: 8 }}>{meta}</div>}
            </div>
          </div>
          <Brand size={40} />
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 64px", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, color: SOFT }}>Implied value per share</div>
            <div style={{ fontSize: 124, fontFamily: "Plex Mono", letterSpacing: -6, lineHeight: 1.02, color: card.warn ? RED : INK }}>{money(card.value)}</div>
            {card.warn && <div style={{ fontSize: 23, color: RED, marginTop: 4 }}>Cash flow is negative in year 5, so this isn&apos;t meaningful yet.</div>}
            {!card.warn && card.range && (
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                {[
                  { k: "Bear", v: card.range.bear, c: RED },
                  { k: "Weighted", v: card.range.weighted, c: INK },
                  { k: "Bull", v: card.range.bull, c: GREEN },
                ].map((x) => (
                  <div key={x.k} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 14px", borderRadius: 999, border: `2px solid ${x.c}`, background: SHEET }}>
                    <div style={{ fontSize: 19, color: x.c, fontWeight: 800 }}>{x.k}</div>
                    <div style={{ fontSize: 22, fontFamily: "Plex Mono" }}>{money(x.v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "26px 32px", background: SHEET, border: `2.5px solid ${INK}`, borderRadius: 14, minWidth: 330 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 21, color: SOFT }}>Market price</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <div style={{ fontSize: 44, fontFamily: "Plex Mono", letterSpacing: -2 }}>{money(card.price)}</div>
                <div style={{ fontSize: 26, fontFamily: "Plex Mono", color: upside < 0 ? RED : GREEN }}>
                  {`${upside > 0 ? "+" : upside < 0 ? "−" : ""}${Math.abs(upside * 100).toFixed(1)}%`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1.5px solid ${RULE}`, paddingTop: 18 }}>
              <div style={{ fontSize: 21, color: SOFT }}>Model quality</div>
              <Stars value={card.stars} />
            </div>
          </div>
        </div>

        <Footer host={host} note="Discounted cash flow model. Open it and change any assumption." />
      </div>
    ),
    opts,
  );
}

const CALL = "#3f8a55";
const PUT = "#2b5aa0";
const longDate = (d: string) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

function OptionImage({ card, logo, host }: { card: OptionCard; logo: string | null; host: string }) {
  const initial = (card.name.trim()[0] ?? "?").toUpperCase();
  const box = (t: "call" | "put") => {
    const sel = card.type === t;
    const color = t === "call" ? CALL : PUT;
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", flex: 1, padding: "22px 30px 26px", background: SHEET,
          border: `${sel ? 4 : 2}px solid ${sel ? INK : RULE}`, borderTop: `10px solid ${color}`, borderRadius: 14,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color }}>{t === "call" ? "Call" : "Put"}</div>
        <div style={{ display: "flex", fontSize: 96, fontFamily: "Plex Mono", letterSpacing: -5, lineHeight: 1.05 }}>{money(t === "call" ? card.call : card.put)}</div>
        <div style={{ display: "flex", fontSize: 22, color: SOFT }}>{`${money((t === "call" ? card.call : card.put) * 100)} per contract`}</div>
      </div>
    );
  };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Schibsted", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 64px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={96} height={96} style={{ borderRadius: 20, border: `2px solid ${RULE}`, background: "#ffffff", padding: 11, objectFit: "contain" }} alt="" />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 20, background: INK, color: SHEET, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, fontWeight: 800 }}>
              {initial}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
            <div style={{ display: "flex", fontSize: 50, fontWeight: 800, letterSpacing: -2, lineHeight: 1.04 }}>{card.name}</div>
            <div style={{ display: "flex", gap: 26, fontSize: 23, color: FAINT, fontFamily: "Plex Mono", marginTop: 8 }}>
              <div style={{ display: "flex", color: INK }}>{card.ticker}</div>
              <div style={{ display: "flex" }}>{`Strike ${money(card.K)}`}</div>
              <div style={{ display: "flex" }}>{`Expires ${longDate(card.expiry)}`}</div>
            </div>
          </div>
        </div>
        <Brand size={40} />
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 24, padding: "0 64px" }}>
        {box("call")}
        {box("put")}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 250 }}>
          {[
            ["Share price", money(card.S)],
            ["Volatility", `${(card.sigma * 100).toFixed(1)}%`],
            ["Days left", String(card.days)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", borderLeft: `3px solid ${RULE}`, paddingLeft: 14 }}>
              <div style={{ display: "flex", fontSize: 20, color: SOFT }}>{k}</div>
              <div style={{ display: "flex", fontSize: 34, fontFamily: "Plex Mono", letterSpacing: -1 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer host={host} note="Black-Scholes option pricing. Open it and change any input." />
    </div>
  );
}
