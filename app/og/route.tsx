import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readCard } from "@/lib/og";

// The preview image LinkedIn, Slack, iMessage and others show for a link.
export const runtime = "nodejs";

const PAPER = "#eef1e8";
const SHEET = "#f7f9f3";
const INK = "#18201c";
const SOFT = "#4a5650";
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

function Stars({ value }: { value: number }) {
  const d = "M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z";
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} width="40" height="40" viewBox="0 0 20 20">
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

function Frame({ children, host, note }: { children: React.ReactNode; host: string; note: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "Schibsted", color: INK }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "44px 64px 28px", borderBottom: `4px solid ${INK}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mark size={52} />
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5 }}>Valora</div>
        </div>
        <div style={{ fontSize: 26, color: SOFT }}>Build a DCF from the ground up</div>
      </div>
      <div style={{ display: "flex", flex: 1, padding: "0 64px" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 64px 30px", borderTop: `1.5px solid ${RULE}`, fontSize: 22, color: SOFT }}>
        <div style={{ display: "flex" }}>{note}</div>
        <div style={{ display: "flex", fontFamily: "Plex Mono" }}>{host}</div>
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host;
  const card = readCard(url.searchParams);
  const opts = { width: 1200, height: 630, fonts: await loadFonts() };

  if (!card) {
    return new ImageResponse(
      (
        <Frame host={host} note="Free to use, no sign-up">
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
            <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, maxWidth: 980 }}>
              Value any US company from its 10-K, one assumption at a time.
            </div>
            <div style={{ fontSize: 30, color: SOFT, maxWidth: 940, lineHeight: 1.35 }}>
              A guided discounted cash flow builder for students, with sanity checks on every input.
            </div>
          </div>
        </Frame>
      ),
      opts,
    );
  }

  const upside = card.value / card.price - 1;
  const label = [card.ticker, card.year ? `${card.year} 10-K` : ""].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <Frame host={host} note="Open the model and change any assumption">
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
            <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{card.name}</div>
            {label && <div style={{ fontSize: 26, color: SOFT, fontFamily: "Plex Mono", marginTop: 10 }}>{label}</div>}
            <div style={{ fontSize: 26, color: SOFT, marginTop: 34 }}>Implied value per share</div>
            <div style={{ fontSize: 112, fontFamily: "Plex Mono", letterSpacing: -5, lineHeight: 1.05, color: card.warn ? RED : INK }}>
              {money(card.value)}
            </div>
            {card.warn && (
              <div style={{ fontSize: 24, color: RED, marginTop: 6 }}>Cash flow is negative in year 5, so this value isn&apos;t meaningful yet.</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 26, padding: "30px 34px", background: SHEET, border: `3px solid ${INK}`, minWidth: 330 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: SOFT }}>Market price</div>
              <div style={{ fontSize: 48, fontFamily: "Plex Mono", letterSpacing: -2 }}>{money(card.price)}</div>
              <div style={{ fontSize: 30, fontFamily: "Plex Mono", color: upside < 0 ? RED : GREEN }}>
                {`${upside > 0 ? "+" : upside < 0 ? "−" : ""}${Math.abs(upside * 100).toFixed(1)}%`}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1.5px solid ${RULE}`, paddingTop: 20 }}>
              <div style={{ fontSize: 22, color: SOFT }}>Model quality</div>
              <Stars value={card.stars} />
            </div>
          </div>
        </div>
      </Frame>
    ),
    opts,
  );
}
