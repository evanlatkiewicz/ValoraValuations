// The one-page snapshot for banks, insurers and REITs. Same design as the
// company snapshot; the middle bands show equity, returns and price to book.
import { Document, Page, Rect, Svg, Text, View } from "@react-pdf/renderer";
import type { FinSnapshotData } from "@/lib/finSnapshot";
import {
  GREEN, INK, OptionsBlock, PAPER, RED, RULE, s, SnapFooter, SnapHeader, SOFT, Stars, Stat, StockBand, TINT, AMBER,
  date, mil, mult, pct, short, spct, usd, big,
} from "./SnapshotDoc";

function Bridge({ data, w }: { data: FinSnapshotData; w: number }) {
  const v = data.valuation;
  const parts = [
    { k: "Book value", v: v.parts.book, c: INK },
    { k: "Excess returns, 5 years", v: v.parts.excess, c: v.parts.excess >= 0 ? GREEN : RED },
    { k: "After year 5", v: v.parts.terminal, c: v.parts.terminal >= 0 ? GREEN : RED },
  ];
  const max = Math.max(v.value, v.parts.book, data.quote.price) * 1.06;
  const L = 96, R = 52, bw = w - L - R;
  let run = 0;
  return (
    <View style={{ marginTop: 4 }}>
      {parts.map((p) => {
        const from = run;
        run += p.v;
        const a = Math.max(Math.min(from, run), 0), b = Math.max(from, run);
        return (
          <View key={p.k} style={[s.row, { alignItems: "center", marginBottom: 3 }]}>
            <Text style={{ width: L, color: SOFT, fontSize: 7.5 }}>{p.k}</Text>
            <Svg width={bw} height={9}>
              <Rect x={0} y={0} width={bw} height={9} fill={PAPER} />
              <Rect x={(a / max) * bw} y={0} width={Math.max(((b - a) / max) * bw, 1)} height={9} fill={p.c} />
            </Svg>
            <Text style={[s.mono, { width: R, textAlign: "right", fontSize: 7.5 }]}>{`${p.k !== "Book value" && p.v >= 0 ? "+" : ""}${usd(p.v)}`}</Text>
          </View>
        );
      })}
      <View style={[s.row, { alignItems: "center", borderTopWidth: 1, borderTopColor: INK, paddingTop: 3 }]}>
        <Text style={{ width: L, fontWeight: 700, fontSize: 7.5 }}>Value per share</Text>
        <Svg width={bw} height={9}>
          <Rect x={0} y={0} width={bw} height={9} fill={PAPER} />
          <Rect x={0} y={0} width={(Math.max(v.value, 0) / max) * bw} height={9} fill={INK} />
          <Rect x={(data.quote.price / max) * bw - 0.75} y={0} width={1.5} height={9} fill={AMBER} />
        </Svg>
        <Text style={[s.mono, { width: R, textAlign: "right", fontSize: 7.5, fontWeight: 600 }]}>{usd(v.value)}</Text>
      </View>
      <Text style={[s.cap, { marginTop: 2, color: AMBER }]}>{`Orange mark: today's price, ${usd(data.quote.price)}`}</Text>
    </View>
  );
}

export function FinSnapshotDoc({ data, logo, url }: { data: FinSnapshotData; logo: string | null; url: string }) {
  const q = data.quote;
  const v = data.valuation;
  const half = (552 - 22) / 2;
  return (
    <Document title={`${data.company.name} (${data.company.ticker}) snapshot`} author="Valora" creator="Valora">
      <Page size="LETTER" style={s.page} wrap={false}>
        <SnapHeader company={data.company} today={data.today} logo={logo} subtitle={`${data.company.kindLabel} snapshot`} />
        <StockBand quote={q} chart={data.chart} yearReturn={data.yearReturn} />

        {/* Equity and returns */}
        <View style={s.band}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.h2}>Earnings, equity and returns</Text>
            <Text style={s.cap}>$ in US dollars. Shaded years are the model&apos;s forecast. Payouts are dividends plus buybacks.</Text>
          </View>
          <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 2 }]}>
            <Text style={{ width: 92 }} />
            {data.trends.map((t) => (
              <Text key={t.label} style={[s.mono, { flex: 1, textAlign: "right", fontWeight: 600, color: t.projected ? SOFT : INK }]}>{t.label}</Text>
            ))}
          </View>
          {(
            [
              ["Net income", (t) => mil(t.netIncome)],
              ["Book equity", (t) => mil(t.bookEquity)],
              ["Return on equity", (t) => pct(t.roe)],
              ["Payouts", (t) => mil(t.payouts)],
            ] as [string, (t: FinSnapshotData["trends"][number]) => string][]
          ).map(([k, f]) => (
            <View key={k} style={[s.row, s.rule, { paddingVertical: 2.4 }]}>
              <Text style={{ width: 92, color: SOFT }}>{k}</Text>
              {data.trends.map((t) => (
                <Text key={t.label} style={[s.mono, { flex: 1, textAlign: "right", backgroundColor: t.projected ? TINT : undefined, paddingRight: 2 }]}>{f(t)}</Text>
              ))}
            </View>
          ))}
        </View>

        {/* Valuation and peers */}
        <View style={[s.band, s.row]}>
          <View style={{ width: half }}>
            <Text style={s.h2}>Excess return valuation</Text>
            <View style={[s.row, { alignItems: "flex-end" }]}>
              <Text style={[s.mono, { fontSize: 22, fontWeight: 600, letterSpacing: -1 }]}>{usd(v.value)}</Text>
              <Text style={[s.mono, { fontSize: 9.5, marginLeft: 8, marginBottom: 3, color: v.upside >= 0 ? GREEN : RED }]}>{`${spct(v.upside, 0)} vs. price`}</Text>
            </View>
            <Text style={[s.cap, { marginBottom: 4 }]}>{`${v.impliedPb.toFixed(2)}x book value of ${usd(v.bookPerShare)}. The market pays ${v.marketPb.toFixed(2)}x.`}</Text>
            <Bridge data={data} w={half} />
            <Stat k="Cost of equity" v={pct(v.costOfEquity, 2)} />
            <Stat k="Long-run return on equity" v={pct(v.longRunRoe)} />
            <View style={[s.row, s.rule, { justifyContent: "space-between", alignItems: "center", paddingVertical: 2.2 }]}>
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
                  <Text style={{ width: 44, textAlign: "right", color: SOFT }}>P/B</Text>
                  <Text style={{ width: 40, textAlign: "right", color: SOFT }}>P/E</Text>
                </View>
                <View style={[s.row, s.rule, { paddingVertical: 2.4, backgroundColor: TINT }]}>
                  <Text style={{ flex: 1, fontWeight: 700 }}>{data.company.ticker}</Text>
                  <Text style={[s.mono, { width: 56, textAlign: "right" }]}>{big(q.marketCap)}</Text>
                  <Text style={[s.mono, { width: 44, textAlign: "right" }]}>{mult(data.peers.selfPb)}</Text>
                  <Text style={[s.mono, { width: 40, textAlign: "right" }]}>{mult(data.peers.selfPe)}</Text>
                </View>
                {data.peers.rows.map((p) => (
                  <View key={p.symbol} style={[s.row, s.rule, { paddingVertical: 2.4 }]}>
                    <View style={[s.row, { flex: 1 }]}>
                      <Text style={{ fontWeight: 700, width: 34 }}>{p.symbol}</Text>
                      <Text style={{ color: SOFT }}>{short(p.name)}</Text>
                    </View>
                    <Text style={[s.mono, { width: 56, textAlign: "right" }]}>{p.marketCap ? big(p.marketCap) : "n/a"}</Text>
                    <Text style={[s.mono, { width: 44, textAlign: "right" }]}>{mult(p.pb ?? null)}</Text>
                    <Text style={[s.mono, { width: 40, textAlign: "right" }]}>{mult(p.pe)}</Text>
                  </View>
                ))}
                <View style={[s.row, { paddingVertical: 2.4, borderTopWidth: 1, borderTopColor: INK }]}>
                  <Text style={{ flex: 1, fontWeight: 700 }}>Peer median</Text>
                  <Text style={{ width: 56 }} />
                  <Text style={[s.mono, { width: 44, textAlign: "right", fontWeight: 600 }]}>{mult(data.peers.medianPb)}</Text>
                  <Text style={[s.mono, { width: 40, textAlign: "right", fontWeight: 600 }]}>{mult(data.peers.medianPe)}</Text>
                </View>
                {data.peers.valueAtMedianPb !== null && (
                  <Text style={[s.cap, { marginTop: 4 }]}>
                    {`At the peer median price to book, the stock would be worth ${usd(data.peers.valueAtMedianPb)} a share (${spct(data.peers.valueAtMedianPb / q.price - 1, 0)} vs. today).`}
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
          <OptionsBlock options={data.options} quote={q} width={half} />
          <View style={{ width: half, marginLeft: 22 }}>
            <Text style={s.h2}>What to look at</Text>
            {v.impliedRoe !== null && (
              <Text style={{ marginBottom: 4 }}>
                {`To justify today's price, the company would need a long-run return on equity of ${pct(v.impliedRoe)}, against ${pct(v.longRunRoe)} in the model and a ${pct(v.costOfEquity)} cost of equity.`}
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

        <SnapFooter url={url} note={`Valued on ${date(data.today)} with the excess return model; for learning, not investment advice.`} />
      </Page>
    </Document>
  );
}
