// The one-page company snapshot, drawn with @react-pdf/renderer.
// Loaded only when someone downloads a snapshot, so it never slows the site.
import { Document, Font, Image, Line, Page, Path, Polygon, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { SnapshotData } from "@/lib/snapshot";

let registered = false;
export function registerFonts(origin: string) {
  if (registered) return;
  Font.register({
    family: "Schibsted",
    fonts: [
      { src: `${origin}/fonts/schibsted-grotesk-latin-400-normal.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/schibsted-grotesk-latin-700-normal.ttf`, fontWeight: 700 },
      { src: `${origin}/fonts/schibsted-grotesk-latin-800-normal.ttf`, fontWeight: 800 },
    ],
  });
  Font.register({
    family: "Plex",
    fonts: [
      { src: `${origin}/fonts/ibm-plex-mono-latin-400-normal.ttf`, fontWeight: 400 },
      { src: `${origin}/fonts/ibm-plex-mono-latin-600-normal.ttf`, fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]); // no hyphenation
  registered = true;
}

const PAPER = "#f7f9f3";
const INK = "#18201c";
const SOFT = "#4a5650";
const FAINT = "#7a857e";
const RULE = "#cfd9c8";
const TINT = "#e3e8db";
const GREEN = "#2f5d46";
const RED = "#b0281f";
const AMBER = "#a86c12";

// ---------- formatting ----------
const usd = (n: number, d = 2) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const big = (dollars: number) => {
  const a = Math.abs(dollars);
  const s = a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B` : `${(a / 1e6).toFixed(0)}M`;
  return `${dollars < 0 ? "−" : ""}$${s}`;
};
const mil = (m: number) => big(m * 1e6);
const pct = (x: number | null, d = 1) => (x === null || !Number.isFinite(x) ? "n/a" : `${(x * 100).toFixed(d)}%`);
const spct = (x: number | null, d = 1) => (x === null || !Number.isFinite(x) ? "n/a" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(d)}%`);
const mult = (x: number | null) => (x === null || !Number.isFinite(x) || x <= 0 || x > 999 ? "n/a" : `${x.toFixed(1)}x`);
const vol = (v: number | null) => (v === null ? "n/a" : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`);
// Drop legal suffixes so peer names fit on one line
const short = (n: string) => {
  const t = n.replace(/,?\s+(Inc\.?|Corporation|Corp\.?|Co\.?|Company|Ltd\.?|plc|PLC|N\.V\.|Holdings?|Group)$/i, "").replace(/,?\s+(Inc\.?|Corporation|Corp\.?|Group)$/i, "");
  return t.length > 20 ? t.slice(0, 19) + "…" : t;
};
const date = (d: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "n/a";

const s = StyleSheet.create({
  page: { backgroundColor: PAPER, color: INK, fontFamily: "Schibsted", fontSize: 8.5, paddingHorizontal: 30, paddingTop: 26, paddingBottom: 44 },
  row: { flexDirection: "row" },
  h2: { fontSize: 10, fontWeight: 800, letterSpacing: -0.2, marginBottom: 5 },
  cap: { fontSize: 7.5, color: SOFT },
  mono: { fontFamily: "Plex" },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE },
  band: { marginTop: 9, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: INK },
});

function Stars({ value }: { value: number }) {
  const pts = (cx: number) => {
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.4 : 5.5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(6 + r * Math.sin(a)).toFixed(2)}`);
    }
    return out.join(" ");
  };
  return (
    <Svg width={64} height={12}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return <Polygon key={i} points={pts(6 + i * 13)} fill={fill >= 0.75 ? INK : fill >= 0.25 ? FAINT : "none"} stroke={INK} strokeWidth={0.8} />;
      })}
    </Svg>
  );
}

function PriceChart({ data, w, h }: { data: SnapshotData; w: number; h: number }) {
  const pts = data.chart;
  if (pts.length < 2) return <Text style={s.cap}>No price history available.</Text>;
  const cs = pts.map((p) => p.c);
  const lo = Math.min(...cs), hi = Math.max(...cs);
  const pad = (hi - lo) * 0.08 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const L = 0, R = 34, T = 4, B = 14;
  const x = (i: number) => L + ((w - L - R) * i) / (pts.length - 1);
  const y = (v: number) => T + (h - T - B) * (1 - (v - y0) / (y1 - y0));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join("");
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${h - B}L${x(0).toFixed(1)},${h - B}Z`;
  const up = (data.yearReturn ?? 0) >= 0;
  const color = up ? GREEN : RED;
  const ticks = [hi, (hi + lo) / 2, lo];
  const months = [0, Math.floor(pts.length / 3), Math.floor((2 * pts.length) / 3), pts.length - 1];
  return (
    <Svg width={w} height={h}>
      {ticks.map((v, i) => (
        <Line key={i} x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke={RULE} strokeWidth={0.6} />
      ))}
      <Path d={area} fill={up ? "#dbe7dc" : "#f1dcd6"} />
      <Path d={line} stroke={color} strokeWidth={1.3} fill="none" />
      {ticks.map((v, i) => (
        <Text key={i} x={w - R + 4} y={y(v) + 2.5} style={{ fontSize: 6.5, fontFamily: "Plex" }} fill={FAINT}>
          {usd(v, v >= 100 ? 0 : 2)}
        </Text>
      ))}
      {months.map((i) => (
        <Text key={i} x={Math.min(Math.max(x(i) - 14, 0), w - R - 30)} y={h - 3} style={{ fontSize: 6.5 }} fill={FAINT}>
          {new Date(pts[i].d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })}
        </Text>
      ))}
    </Svg>
  );
}

function RangeBar({ data, w }: { data: SnapshotData; w: number }) {
  const c = data.valuation.cases;
  if (!c) return null;
  const vals = [c.bear, c.base, c.bull, c.weighted, data.quote.price];
  const lo = Math.min(...vals) * 0.92, hi = Math.max(...vals) * 1.05;
  const x = (v: number) => ((w - 8) * (v - lo)) / (hi - lo) + 4;
  return (
    <Svg width={w} height={34}>
      <Rect x={x(c.bear)} y={10} width={Math.max(x(c.bull) - x(c.bear), 2)} height={8} fill={TINT} />
      <Rect x={x(c.bear) - 1} y={8} width={2} height={12} fill={RED} />
      <Rect x={x(c.bull) - 1} y={8} width={2} height={12} fill={GREEN} />
      <Rect x={x(c.base) - 1} y={8} width={2} height={12} fill={INK} />
      <Polygon points={`${x(c.weighted) - 3.5},4 ${x(c.weighted) + 3.5},4 ${x(c.weighted)},9`} fill={INK} />
      <Line x1={x(data.quote.price)} x2={x(data.quote.price)} y1={2} y2={24} stroke={AMBER} strokeWidth={1.2} strokeDasharray="2 1.5" />
      <Text x={Math.min(Math.max(x(data.quote.price) - 18, 0), w - 40)} y={32} style={{ fontSize: 6.5 }} fill={AMBER}>
        {`Price ${usd(data.quote.price, 0)}`}
      </Text>
    </Svg>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <View style={[s.row, s.rule, { justifyContent: "space-between", paddingVertical: 2.2 }]}>
      <Text style={{ color: SOFT }}>{k}</Text>
      <Text style={[s.mono, { color: color ?? INK }]}>{v}</Text>
    </View>
  );
}

export function SnapshotDoc({ data, logo, url }: { data: SnapshotData; logo: string | null; url: string }) {
  const q = data.quote;
  const v = data.valuation;
  const chg = q.change ?? 0;
  const W = 552;
  const half = (W - 22) / 2;

  return (
    <Document title={`${data.company.name} (${data.company.ticker}) snapshot`} author="Valora" creator="Valora">
      <Page size="LETTER" style={s.page} wrap={false}>
        {/* Header */}
        <View style={[s.row, { alignItems: "center", justifyContent: "space-between" }]}>
          <View style={[s.row, { alignItems: "center" }]}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={{ width: 34, height: 34, borderRadius: 7, borderWidth: 1, borderColor: RULE, backgroundColor: "#fff", padding: 3.5, objectFit: "contain" }} />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: INK, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: PAPER, fontSize: 16, fontWeight: 800 }}>{data.company.name.trim()[0]?.toUpperCase() ?? "?"}</Text>
              </View>
            )}
            <View style={{ marginLeft: 10 }}>
              <Text style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.6 }}>{data.company.name}</Text>
              <Text style={[s.cap, s.mono, { marginTop: 2 }]}>
                {`${data.company.ticker}    ${data.company.baseYear} ${data.company.form}${data.company.currency ? ` (from ${data.company.currency})` : ""}    Snapshot ${date(data.today)}`}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.4 }}>Valora</Text>
            <Text style={s.cap}>Company snapshot</Text>
          </View>
        </View>

        {/* The stock */}
        <View style={[s.band, s.row]}>
          <View style={{ width: 332 }}>
            <View style={[s.row, { alignItems: "flex-end" }]}>
              <Text style={[s.mono, { fontSize: 24, fontWeight: 600, letterSpacing: -1 }]}>{usd(q.price)}</Text>
              {q.change !== null && (
                <Text style={[s.mono, { fontSize: 10, marginLeft: 8, marginBottom: 3, color: chg >= 0 ? GREEN : RED }]}>
                  {`${chg >= 0 ? "+" : "−"}${usd(Math.abs(chg))} (${spct(q.changePct, 2)})`}
                </Text>
              )}
            </View>
            <Text style={[s.cap, { marginBottom: 4 }]}>{`Close on ${date(q.priceDate)}. Past year: ${spct(data.yearReturn)}`}</Text>
            <PriceChart data={data} w={332} h={104} />
          </View>
          <View style={{ width: 198, marginLeft: 22 }}>
            <Text style={s.h2}>Key statistics</Text>
            <Stat k="Open" v={q.open ? usd(q.open) : "n/a"} />
            <Stat k="Day range" v={q.low && q.high ? `${usd(q.low)} – ${usd(q.high)}` : "n/a"} />
            <Stat k="52-week range" v={q.low52 && q.high52 ? `${usd(q.low52, 0)} – ${usd(q.high52, 0)}` : "n/a"} />
            <Stat k="Volume" v={vol(q.volume)} />
            <Stat k="Avg volume (30 days)" v={vol(q.avgVolume)} />
            <Stat k="Market cap" v={big(q.marketCap)} />
            <Stat k="P/E ratio" v={mult(q.pe)} />
            <Stat k="Dividend yield" v={q.divYield ? pct(q.divYield, 2) : "None"} />
            <Stat k="Beta" v={q.beta.toFixed(2)} />
            <Stat k="Next earnings" v={q.nextEarnings ? date(q.nextEarnings) : "n/a"} />
          </View>
        </View>

        {/* Financials */}
        <View style={s.band}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.h2}>Financials and forecast</Text>
            <Text style={s.cap}>$ in US dollars. Shaded years are the model&apos;s forecast. Free cash flow is after taxes and reinvestment.</Text>
          </View>
          <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 2 }]}>
            <Text style={{ width: 92, color: SOFT }} />
            {data.trends.map((t) => (
              <Text key={t.label} style={[s.mono, { flex: 1, textAlign: "right", fontWeight: 600, color: t.projected ? SOFT : INK }]}>
                {t.label}
              </Text>
            ))}
          </View>
          {(
            [
              ["Revenue", (t) => mil(t.revenue)],
              ["Revenue growth", (t) => spct(t.growth)],
              ["Operating margin", (t) => pct(t.margin)],
              ["Free cash flow", (t) => mil(t.fcf)],
            ] as [string, (t: SnapshotData["trends"][number]) => string][]
          ).map(([k, f]) => (
            <View key={k} style={[s.row, s.rule, { paddingVertical: 2.4 }]}>
              <Text style={{ width: 92, color: SOFT }}>{k}</Text>
              {data.trends.map((t) => (
                <Text key={t.label} style={[s.mono, { flex: 1, textAlign: "right", backgroundColor: t.projected ? TINT : undefined, paddingRight: 2 }]}>
                  {f(t)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Valuation and peers */}
        <View style={[s.band, s.row]}>
          <View style={{ width: half }}>
            <Text style={s.h2}>DCF valuation</Text>
            <View style={[s.row, { alignItems: "flex-end" }]}>
              <Text style={[s.mono, { fontSize: 22, fontWeight: 600, letterSpacing: -1, color: v.warn ? RED : INK }]}>{usd(v.value)}</Text>
              <Text style={[s.mono, { fontSize: 9.5, marginLeft: 8, marginBottom: 3, color: v.upside >= 0 ? GREEN : RED }]}>{`${spct(v.upside, 0)} vs. price`}</Text>
            </View>
            <Text style={s.cap}>
              {v.warn ? "Free cash flow is negative in year 5, so this value isn't meaningful yet." : "Implied value per share, base case."}
            </Text>
            {v.cases && (
              <>
                <View style={[s.row, { marginTop: 6, justifyContent: "space-between" }]}>
                  {(
                    [
                      ["Bear", v.cases.bear, RED, v.cases.weights[0]],
                      ["Base", v.cases.base, INK, v.cases.weights[1]],
                      ["Bull", v.cases.bull, GREEN, v.cases.weights[2]],
                      ["Weighted", v.cases.weighted, INK, null],
                    ] as [string, number, string, number | null][]
                  ).map(([k, val, c, w]) => (
                    <View key={k}>
                      <Text style={{ fontSize: 7, color: c, fontWeight: 700 }}>{w !== null ? `${k} ${Math.round(w * 100)}%` : k}</Text>
                      <Text style={[s.mono, { fontSize: 9.5 }]}>{usd(val)}</Text>
                    </View>
                  ))}
                </View>
                <RangeBar data={data} w={half} />
              </>
            )}
            <Stat k="Discount rate (WACC)" v={pct(v.wacc, 2)} />
            <Stat k={v.method === "gordon" ? "Terminal growth" : "Exit multiple"} v={v.method === "gordon" ? pct(v.terminal, 1) : mult(v.terminal)} />
            <Stat k="Terminal value share of EV" v={pct(v.tvShare, 0)} />
            <View style={[s.row, s.rule, { justifyContent: "space-between", alignItems: "center", paddingVertical: 2.4 }]}>
              <Text style={{ color: SOFT }}>{`Model quality (${v.greenChecks} of ${v.totalChecks} checks green)`}</Text>
              <Stars value={v.stars} />
            </View>
          </View>

          <View style={{ width: half, marginLeft: 22 }}>
            <Text style={s.h2}>How peers are priced</Text>
            {data.peers ? (
              <>
                <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 2 }]}>
                  <Text style={{ flex: 1, color: SOFT }}>Company</Text>
                  <Text style={{ width: 56, textAlign: "right", color: SOFT }}>Market cap</Text>
                  <Text style={{ width: 52, textAlign: "right", color: SOFT }}>EV/EBITDA</Text>
                  <Text style={{ width: 40, textAlign: "right", color: SOFT }}>P/E</Text>
                </View>
                <View style={[s.row, s.rule, { paddingVertical: 2.4, backgroundColor: TINT }]}>
                  <Text style={{ flex: 1, fontWeight: 700 }}>{data.company.ticker}</Text>
                  <Text style={[s.mono, { width: 56, textAlign: "right" }]}>{big(q.marketCap)}</Text>
                  <Text style={[s.mono, { width: 52, textAlign: "right" }]}>{mult(data.peers.selfEvEbitda)}</Text>
                  <Text style={[s.mono, { width: 40, textAlign: "right" }]}>{mult(q.pe)}</Text>
                </View>
                {data.peers.rows.map((p) => (
                  <View key={p.symbol} style={[s.row, s.rule, { paddingVertical: 2.4 }]}>
                    <View style={[s.row, { flex: 1 }]}>
                      <Text style={{ fontWeight: 700, width: 34 }}>{p.symbol}</Text>
                      <Text style={{ color: SOFT }}>{short(p.name)}</Text>
                    </View>
                    <Text style={[s.mono, { width: 56, textAlign: "right" }]}>{p.marketCap ? big(p.marketCap) : "n/a"}</Text>
                    <Text style={[s.mono, { width: 52, textAlign: "right" }]}>{mult(p.evEbitda)}</Text>
                    <Text style={[s.mono, { width: 40, textAlign: "right" }]}>{mult(p.pe)}</Text>
                  </View>
                ))}
                <View style={[s.row, { paddingVertical: 2.4, borderTopWidth: 1, borderTopColor: INK }]}>
                  <Text style={{ flex: 1, fontWeight: 700 }}>Peer median</Text>
                  <Text style={{ width: 56 }} />
                  <Text style={[s.mono, { width: 52, textAlign: "right", fontWeight: 600 }]}>{mult(data.peers.medianEvEbitda)}</Text>
                  <Text style={[s.mono, { width: 40, textAlign: "right", fontWeight: 600 }]}>{mult(data.peers.medianPe)}</Text>
                </View>
                {data.peers.valueAtMedian !== null && (
                  <Text style={[s.cap, { marginTop: 4 }]}>
                    {`At the peer median EV/EBITDA, the stock would be worth ${usd(data.peers.valueAtMedian)} a share (${spct(data.peers.valueAtMedian / q.price - 1, 0)} vs. today).`}
                  </Text>
                )}
              </>
            ) : (
              <Text style={s.cap}>No US-listed peers with trading data were found.</Text>
            )}
          </View>
        </View>

        {/* Options and notes */}
        <View style={[s.band, s.row]}>
          <View style={{ width: half }}>
            <Text style={s.h2}>Options, three months out</Text>
            {data.options ? (
              <>
                <Text style={[s.cap, { marginBottom: 3 }]}>
                  {`Black-Scholes, ${usd(data.options.strike)} strike, expiring ${date(data.options.expiry)} (${data.options.days} days).`}
                </Text>
                <View style={[s.row, { marginBottom: 3 }]}>
                  <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: "#3f8a55", paddingLeft: 6 }}>
                    <Text style={{ fontSize: 7, color: SOFT }}>Call</Text>
                    <Text style={[s.mono, { fontSize: 13, fontWeight: 600 }]}>{usd(data.options.call)}</Text>
                  </View>
                  <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: "#2b5aa0", paddingLeft: 6 }}>
                    <Text style={{ fontSize: 7, color: SOFT }}>Put</Text>
                    <Text style={[s.mono, { fontSize: 13, fontWeight: 600 }]}>{usd(data.options.put)}</Text>
                  </View>
                </View>
                <Stat k="Historical volatility (1 year)" v={pct(data.options.vol)} />
                <Stat k="Expected move by expiration" v={`±${usd(data.options.expectedMove)} (${pct(data.options.expectedMove / q.price, 1)})`} />
                <Stat k="Treasury yield for the term" v={pct(data.options.rate, 2)} />
                {data.options.earningsBefore && (
                  <Text style={[s.cap, { color: AMBER, marginTop: 3 }]}>
                    {`Earnings on ${date(q.nextEarnings)} fall before expiration, so real prices are likely higher.`}
                  </Text>
                )}
              </>
            ) : (
              <Text style={s.cap}>Not enough price history to measure volatility.</Text>
            )}
          </View>

          <View style={{ width: half, marginLeft: 22 }}>
            <Text style={s.h2}>What to look at</Text>
            {v.reverseWacc !== null && (
              <Text style={{ marginBottom: 4 }}>
                {`To justify today's price, the model would need a discount rate of ${pct(v.reverseWacc, 2)}, against ${pct(v.wacc, 2)} used. ${v.reverseWacc < v.wacc ? "The market sees the cash flows as safer, or expects more growth." : "The market sees more risk than the model."}`}
              </Text>
            )}
            {data.issues.length ? (
              data.issues.map((i) => (
                <View key={i.title} style={[s.row, { marginTop: 3 }]}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i.level === "bad" ? RED : AMBER, marginTop: 2.5, marginRight: 5 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 700 }}>{i.title}</Text>
                    <Text style={{ color: SOFT }}>{i.message.length > 120 ? i.message.slice(0, 118).replace(/\s+\S*$/, "") + "…" : i.message}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: SOFT }}>Every sanity check on the model is green.</Text>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={{ position: "absolute", left: 30, right: 30, bottom: 20, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 5 }} fixed>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={{ fontSize: 6.5, color: FAINT, width: 430, lineHeight: 1.3 }}>
              Financials from SEC EDGAR filings. Prices from Twelve Data. Treasury yields from FRED. Peers and earnings dates from Financial
              Modeling Prep. The valuation reflects the assumptions in this model and is for learning, not investment advice.
            </Text>
            <Text style={[s.mono, { fontSize: 6.5, color: INK }]}>{url}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
