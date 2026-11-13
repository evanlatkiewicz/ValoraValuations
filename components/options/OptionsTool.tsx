"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu } from "../Menu";
import { Mark } from "../ui";
import { TickerSearch } from "../TickerSearch";
import { ToolNav } from "../ToolNav";
import { CompanyLogo } from "../CompanyBar";
import { StartScreen, type StartCopy } from "../StartScreen";
import { starRating, type Check } from "@/lib/checks";
import { fmtDate, type MarketData } from "@/lib/market";
import { historicalVol } from "@/lib/options";
import { expiryIn, optionChecks, roundStrike, runOption, todayISO, type OptionModel, type OptionRun } from "@/lib/optionModel";
import type { RiskFree } from "@/lib/rates";
import { FALLBACK_RF } from "@/lib/rates";
import { price as fmtPrice } from "@/lib/format";
import { ContractStage } from "./ContractStage";
import { OptModelStage } from "./OptModelStage";
import { OptResultsStage } from "./OptResultsStage";

export type OptStage = "contract" | "model" | "results";

export interface OptCtx {
  m: OptionModel;
  run: OptionRun;
  checks: Check[];
  stars: number;
  market: MarketData | null;
  rf: RiskFree | null;
  set: (patch: Partial<OptionModel>, fields?: string[]) => void;
  go: (s: OptStage) => void;
}

const COPY: StartCopy = {
  title: "Price an option.",
  lede: "Enter a ticker or start typing a company name. Valora pulls the share price, a year of price history for volatility, the Treasury yield and the dividend, then prices a call and a put with Black-Scholes.",
  button: "Price options on it",
  picks: ["AAPL", "NVDA", "TSLA", "MSFT", "KO", "JPM"],
  steps: [
    ["Contract", "Pick a call or put, a strike and an expiration. Every market input is filled in and editable."],
    ["Model", "Follow the Black-Scholes formula step by step with your numbers, from d1 and d2 to the price."],
    ["Valuation", "See both prices, the Greeks in plain English, a payoff chart, implied volatility and sanity checks."],
  ],
};

const STAGES: { id: OptStage; label: string }[] = [
  { id: "contract", label: "Contract" },
  { id: "model", label: "Model" },
  { id: "results", label: "Valuation" },
];

const KEY = "valora:options";

export function OptionsTool({ initial }: { initial?: OptionModel | null }) {
  const [m, setM] = useState<OptionModel | null>(initial ?? null);
  const [baseline, setBaseline] = useState<OptionModel | null>(initial ?? null);
  const [home, setHome] = useState(!initial);
  const [stage, setStage] = useState<OptStage>(initial ? "results" : "contract");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [rf, setRf] = useState<RiskFree | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    fetch("/api/rates").then((r) => r.json()).then(setRf).catch(() => setRf(null));
    if (!initial) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
        if (saved?.m?.ticker) {
          setM(saved.m);
          setBaseline(saved.baseline ?? saved.m);
          setHome(!!saved.home);
        }
      } catch {
        /* no saved model */
      }
    }
    setRestored(true);
  }, [initial]);

  useEffect(() => {
    if (!restored || !m) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ m, baseline, home }));
    } catch {
      /* storage unavailable */
    }
  }, [m, baseline, home, restored]);

  // Price history for the volatility note and charts, when a model was restored or shared
  useEffect(() => {
    if (!m?.ticker || market?.ticker === m.ticker) return;
    fetch(`/api/prices?ticker=${encodeURIComponent(m.ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMarket(d))
      .catch(() => null);
  }, [m?.ticker, market?.ticker]);

  const load = useCallback(
    async (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t || loading) return;
      setTicker(t);
      setError(null);
      setLoading(`Getting ${t}'s prices`);
      try {
        const [pr, dv, rate] = await Promise.all([
          fetch(`/api/prices?ticker=${encodeURIComponent(t)}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
          fetch(`/api/dividend?ticker=${encodeURIComponent(t)}`).then((r) => r.json()).catch(() => ({})),
          rf ? Promise.resolve(rf) : fetch("/api/rates").then((r) => r.json()).catch(() => FALLBACK_RF),
        ]);
        if (!pr.ok) {
          setError(pr.body?.error ?? `Couldn't find prices for ${t}.`);
          return;
        }
        setLoading("Measuring volatility");
        const md = pr.body as MarketData;
        const hv = historicalVol(md.bars.map((b) => b.c));
        const S = Math.round(md.last.c * 100) / 100;
        const dps: number | null = typeof dv?.dps === "number" ? dv.dps : null;
        const today = todayISO();
        const next: OptionModel = {
          ticker: t,
          name: dv?.name || t,
          logo: md.logo ?? undefined,
          type: "call",
          S,
          priceDate: md.last.d,
          K: roundStrike(S),
          expiry: expiryIn(today, 3),
          valuationDate: today,
          sigma: hv ? Math.round(hv.sigma * 10000) / 10000 : 0.3,
          histVol: hv?.sigma ?? null,
          histDays: hv?.n ?? null,
          treasury: rate.rate,
          treasuryDate: rate.date,
          q: dps ? Math.round((dps / S) * 10000) / 10000 : 0,
          dps,
          marketPrice: null,
          sources: {
            S: `Last close on ${fmtDate(md.last.d)}, from ${md.source}.`,
            sigma: hv
              ? `Historical volatility: the standard deviation of ${hv.n} daily returns over the past year, times the square root of 252 trading days.`
              : "Not enough price history, so this starts at 30%. Enter your own.",
            treasury: rate.live && rate.date ? `10-year Treasury yield on ${fmtDate(rate.date)}, from FRED.` : "Valora's default. Check today's 10-year Treasury yield.",
            q: dps ? `${fmtPrice(dps)} a share in dividends in ${dv.year}, divided by the share price.` : "No dividend found in SEC filings, so this starts at zero.",
          },
        };
        setMarket(md);
        setM(next);
        setBaseline(next);
        setHome(false);
        setStage("contract");
        setTicker("");
        history.replaceState(null, "", "/options");
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setLoading(null);
      }
    },
    [loading, rf],
  );

  const set = useCallback((patch: Partial<OptionModel>, fields: string[] = []) => {
    setM((prev) => {
      if (!prev) return prev;
      const sources = { ...prev.sources };
      for (const f of fields) if (sources[f] && !sources[f].startsWith("You changed")) sources[f] = `You changed this. Original: ${sources[f]}`;
      return { ...prev, ...patch, sources };
    });
  }, []);

  const go = useCallback((s: OptStage) => {
    setStage(s);
    window.scrollTo({ top: 0 });
  }, []);

  const run = useMemo(() => (m ? runOption(m) : null), [m]);
  const checks = useMemo(() => (m && run ? optionChecks(m, run) : []), [m, run]);
  const stars = starRating(checks);
  const edited = m && baseline && JSON.stringify(m) !== JSON.stringify(baseline);

  const header = (
    <header className="top">
      <div className="top-inner">
        <Link className="brand" href="/">
          <Mark />
          <span className="brand-name">Valora</span>
        </Link>
        <ToolNav />
        {!home && m ? (
          <div className="company-pick">
            <TickerSearch id="opt-ticker" size="small" value={ticker} onChange={setTicker} onSubmit={load}
              button={loading ? "Loading" : "Load"} busy={!!loading} placeholder="Ticker or company" />
            {edited && <button className="linkbtn reset-btn" onClick={() => setM(baseline)}>Reset to starting values</button>}
            <button className="linkbtn reset-btn" onClick={() => { setHome(true); setError(null); }}>New option</button>
          </div>
        ) : (
          <span />
        )}
        <Menu optionModel={m && !home ? m : null} />
      </div>
      {!home && m && (
        <nav className="stages" aria-label="Stages">
          {STAGES.map((s, i) => (
            <button key={s.id} className="stage-tab" aria-current={stage === s.id ? "page" : undefined} onClick={() => go(s.id)}>
              <span className="n">{i + 1}</span>
              {s.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );

  return (
    <>
      {header}
      {home || !m || !run ? (
        <StartScreen
          copy={COPY}
          ticker={ticker}
          setTicker={setTicker}
          onLoad={load}
          loading={loading}
          error={error}
          resume={m ? { name: `${m.name} options`, go: () => setHome(false) } : null}
        />
      ) : (
        <>
          <section className="co-bar" aria-label="Underlying stock">
            <div className="co-inner">
              <CompanyLogo name={m.name} logo={m.logo} />
              <div className="co-text">
                <h2 className="co-name">{m.name}</h2>
                <div className="co-meta">
                  <span className="co-ticker">{m.ticker}</span>
                  <span>
                    {m.type === "call" ? "Call" : "Put"}, strike {fmtPrice(m.K)}, expires {fmtDate(m.expiry)} ({run.days} days)
                  </span>
                </div>
              </div>
              <div className="case-switch" role="group" aria-label="Option type">
                {(["call", "put"] as const).map((t) => (
                  <button key={t} className={`case-btn case-${t === "call" ? "bull" : "base"}`} aria-pressed={m.type === t} onClick={() => set({ type: t })}>
                    {t === "call" ? "Call" : "Put"}
                  </button>
                ))}
              </div>
              <div className="co-price">
                <span className="co-price-label">Share price, {fmtDate(m.priceDate)}</span>
                <span className="co-price-value">{fmtPrice(m.S)}</span>
              </div>
            </div>
          </section>
          <main>
            {(() => {
              const ctx: OptCtx = { m, run, checks, stars, market, rf, set, go };
              if (stage === "contract") return <ContractStage ctx={ctx} />;
              if (stage === "model") return <OptModelStage ctx={ctx} />;
              return <OptResultsStage ctx={ctx} />;
            })()}
          </main>
        </>
      )}
      <footer className="foot">
        <span>Valora is a learning tool, not investment advice. Option prices here are model values, not quotes.</span>
        <span>
          Made by <a href="https://www.linkedin.com/in/evanlatkiewicz/" target="_blank" rel="noreferrer">Evan Latkiewicz</a>.{" "}
          <a href="https://github.com/evanlatkiewicz/dcf-builder">Source on GitHub</a>
        </span>
      </footer>
    </>
  );
}
