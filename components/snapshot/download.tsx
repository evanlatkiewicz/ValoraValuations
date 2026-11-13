// Builds and downloads the one-page snapshot. Everything here loads only when
// someone clicks "Download snapshot", so the PDF library never slows the site.
import type { DcfInputs } from "@/lib/types";
import type { MarketData } from "@/lib/market";
import type { Rates } from "@/lib/curve";
import { buildSnapshot } from "@/lib/snapshot";
import { publicOrigin } from "@/lib/site";

const json = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export async function downloadSnapshot(model: DcfInputs, market: MarketData | null, rates: Rates | null): Promise<void> {
  const t = encodeURIComponent(model.company.ticker);
  const [peers, earnings, dividend, freshRates, { pdf }, { SnapshotDoc, registerFonts }] = await Promise.all([
    json(`/api/peers?ticker=${t}`),
    json(`/api/earnings?ticker=${t}`),
    json(`/api/dividend?ticker=${t}`),
    rates?.curve ? Promise.resolve(rates) : json("/api/rates"),
    import("@react-pdf/renderer"),
    import("./SnapshotDoc"),
  ]);
  const r = (freshRates ?? rates) as Rates | null;
  const data = buildSnapshot({
    model,
    market,
    curve: r?.curve ?? null,
    tenYear: r?.rate ?? null,
    peers: peers && Array.isArray(peers.peers) ? peers : null,
    earnings: earnings?.next ?? null,
    dps: typeof dividend?.dps === "number" ? dividend.dps : null,
    today: new Date().toLocaleDateString("en-CA"), // local YYYY-MM-DD
  });
  const domain = (market?.logo ?? model.company.logo ?? "").replace("https://api.twelvedata.com/logo/", "");
  const logo = domain ? `${location.origin}/api/logo?l=${encodeURIComponent(domain)}` : null;
  registerFonts(location.origin);
  const host = publicOrigin().replace(/^https?:\/\//, "");
  const blob = await pdf(<SnapshotDoc data={data} logo={logo} url={`${host}/dcf`} />).toBlob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Valora_${model.company.ticker || "company"}_snapshot_${data.today}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** The bank and insurer version: same data sources, equity-based valuation. */
export async function downloadFinSnapshot(model: import("@/lib/equity").EquityInputs, market: MarketData | null): Promise<void> {
  const t = encodeURIComponent(model.company.ticker);
  const [peers, earnings, dividend, rates, { pdf }, { FinSnapshotDoc }, { registerFonts }, { buildFinSnapshot }] = await Promise.all([
    json(`/api/peers?ticker=${t}`),
    json(`/api/earnings?ticker=${t}`),
    json(`/api/dividend?ticker=${t}`),
    json("/api/rates"),
    import("@react-pdf/renderer"),
    import("./FinSnapshotDoc"),
    import("./SnapshotDoc"),
    import("@/lib/finSnapshot"),
  ]);
  const data = buildFinSnapshot({
    model,
    market,
    curve: (rates as Rates | null)?.curve ?? null,
    tenYear: (rates as Rates | null)?.rate ?? null,
    peers: peers && Array.isArray(peers.peers) ? peers.peers : null,
    earnings: earnings?.next ?? null,
    dps: typeof dividend?.dps === "number" ? dividend.dps : null,
    today: new Date().toLocaleDateString("en-CA"),
  });
  const domain = (market?.logo ?? model.company.logo ?? "").replace("https://api.twelvedata.com/logo/", "");
  const logo = domain ? `${location.origin}/api/logo?l=${encodeURIComponent(domain)}` : null;
  registerFonts(location.origin);
  const host = publicOrigin().replace(/^https?:\/\//, "");
  const blob = await pdf(<FinSnapshotDoc data={data} logo={logo} url={`${host}/financials`} />).toBlob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Valora_${model.company.ticker || "company"}_snapshot_${data.today}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
