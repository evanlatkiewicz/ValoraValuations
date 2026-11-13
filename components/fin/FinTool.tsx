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
import { KIND_LABEL, runEquity, type EquityInputs, type EquityResult } from "@/lib/equity";
import { equityChecks } from "@/lib/equityChecks";
import { fmtDate, type MarketData } from "@/lib/market";
import { price as fmtPrice } from "@/lib/format";
import { FinInputs } from "./FinInputs";
import { FinModel } from "./FinModel";
import { FinResults } from "./FinResults";

export type FinStage = "inputs" | "model" | "results";

export interface FinCtx {
  m: EquityInputs;
  r: EquityResult;
  checks: Check[];
  stars: number;
  market: MarketData | null;
  set: (patch: Partial<EquityInputs>, fields?: string[]) => void;
  go: (s: FinStage) => void;
}

const COPY: StartCopy = {
  title: "Value a bank or insurer.",
  lede: "Banks, insurers and real estate trusts are valued on their equity, not their cash flow. Enter a ticker or company name and Valora builds an excess return model from the company's annual report and today's price.",
  button: "Value this company",
  picks: ["JPM", "GS", "BAC", "WFC", "MET", "SCHW"],
  steps: [
    ["Inputs", "Check book equity, earnings and payouts from the filing, then set returns, payout and the cost of equity."],
    ["Model", "See book value grow year by year, and the profit earned above what shareholders require."],
    ["Valuation", "Get a value per share and price-to-book, a sensitivity table and what today's price implies."],
  ],
};

const STAGES: { id: FinStage; label: string }[] = [
  { id: "inputs", label: "Inputs" },
  { id: "model", label: "Model" },
  { id: "results", label: "Valuation" },
];

const KEY = "valora:fin";

export function FinTool({ initial }: { initial?: EquityInputs | null }) {
  const [m, setM] = useState<EquityInputs | null>(initial ?? null);
  const [baseline, setBaseline] = useState<EquityInputs | null>(initial ?? null);
  const [home, setHome] = useState(!initial);
  const [stage, setStage] = useState<FinStage>(initial ? "results" : "inputs");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [market, setMarket] = useState<MarketData | null>(null);

  const load = useCallback(
    async (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t || loading) return;
      setTicker(t);
      setError(null);
      setLoading(`Reading ${t}'s annual report`);
      try {
        const res = await fetch(`/api/financials?ticker=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Couldn't load ${t}.`);
          return;
        }
        let next = data.inputs as EquityInputs;
        setLoading("Getting prices and beta");
        const md: MarketData | null = await fetch(`/api/prices?ticker=${encodeURIComponent(t)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (md) {
          const beta = md.beta ? Math.round(md.beta.adjusted * 100) / 100 : null;
          next = {
            ...next,
            sharePrice: Math.round(md.last.c * 100) / 100,
            company: { ...next.company, priceDate: md.last.d, ...(md.logo ? { logo: md.logo } : {}) },
            ...(beta ? { beta } : {}),
            sources: {
              ...next.sources,
              sharePrice: { kind: "market", note: `Last close on ${fmtDate(md.last.d)}, from ${md.source}.` },
              ...(beta && md.beta
                ? { beta: { kind: "market", note: `From ${md.beta.weeks} weeks of returns against the S&P 500, Blume-adjusted (0.67 × ${md.beta.raw.toFixed(2)} + 0.33).` } }
                : {}),
            },
          };
        }
        setMarket(md);
        setM(next);
        setBaseline(next);
        setNotes(data.warnings ?? []);
        setHome(false);
        setStage("inputs");
        setTicker("");
        history.replaceState(null, "", "/financials");
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setLoading(null);
      }
    },
    [loading],
  );

  // Restore this tab's model, or load the ticker the Companies tool handed over (?t=GS)
  useEffect(() => {
    if (initial) {
      // A shared link: refresh the logo-less parts quietly, keep the shared numbers
      fetch(`/api/prices?ticker=${encodeURIComponent(initial.company.ticker)}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setMarket(d)).catch(() => null);
      return;
    }
    const t = new URLSearchParams(window.location.search).get("t");
    if (t) {
      load(t);
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      if (saved?.m?.company?.ticker) {
        setM(saved.m);
        setBaseline(saved.baseline ?? saved.m);
        setHome(!!saved.home);
      }
    } catch {
      /* nothing saved */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!m) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ m, baseline, home }));
    } catch {
      /* storage unavailable */
    }
  }, [m, baseline, home]);

  const set = useCallback((patch: Partial<EquityInputs>, fields: string[] = []) => {
    setM((prev) => {
      if (!prev) return prev;
      const sources = { ...prev.sources };
      for (const f of fields) {
        const s = sources[f];
        if (s && s.kind !== "user") sources[f] = { kind: "user", note: `You changed this. Original: ${s.note ?? s.kind}` };
      }
      return { ...prev, ...patch, sources };
    });
  }, []);

  const go = useCallback((s: FinStage) => {
    setStage(s);
    window.scrollTo({ top: 0 });
  }, []);

  const r = useMemo(() => (m ? runEquity(m) : null), [m]);
  const checks = useMemo(() => (m && r ? equityChecks(m, r) : []), [m, r]);
  const stars = starRating(checks);
  const edited = m && baseline && JSON.stringify(m) !== JSON.stringify(baseline);

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <Link className="brand" href="/">
            <Mark />
            <span className="brand-name">Valora</span>
          </Link>
          <ToolNav />
          {!home && m ? (
            <div className="company-pick">
              <TickerSearch id="fin-ticker" size="small" value={ticker} onChange={setTicker} onSubmit={load}
                button={loading ? "Loading" : "Load"} busy={!!loading} placeholder="Ticker or company" />
              {edited && <button className="linkbtn reset-btn" onClick={() => setM(baseline)}>Reset to starting values</button>}
              <button className="linkbtn reset-btn" onClick={() => { setHome(true); setError(null); }}>New valuation</button>
            </div>
          ) : (
            <span />
          )}
          <Menu
            finModel={m && !home ? m : null}
            onSnapshot={
              m && !home && m.sharePrice > 0
                ? async () => (await import("../snapshot/download")).downloadFinSnapshot(m, market)
                : undefined
            }
          />
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

      {home || !m || !r ? (
        <StartScreen
          copy={COPY}
          ticker={ticker}
          setTicker={setTicker}
          onLoad={load}
          loading={loading}
          error={error}
          resume={m ? { name: m.company.name, go: () => setHome(false) } : null}
        />
      ) : (
        <>
          <section className="co-bar" aria-label="Company">
            <div className="co-inner">
              <CompanyLogo name={m.company.name} logo={m.company.logo} />
              <div className="co-text">
                <h2 className="co-name">{m.company.name}</h2>
                <div className="co-meta">
                  <span className="co-ticker">{m.company.ticker}</span>
                  <span>
                    {KIND_LABEL[m.company.kind]}, base year {m.company.baseYearLabel}
                    {m.sources.history?.url && (
                      <>
                        , <a href={m.sources.history.url} target="_blank" rel="noreferrer">{m.company.form ?? "10-K"} filing</a>
                      </>
                    )}
                    {m.company.currency ? `, converted from ${m.company.currency}` : ""}
                  </span>
                </div>
              </div>
              <span />
              <div className="co-price">
                <span className="co-price-label">Share price{m.company.priceDate ? `, ${fmtDate(m.company.priceDate)}` : ""}</span>
                <span className="co-price-value">{m.sharePrice > 0 ? fmtPrice(m.sharePrice) : "n/a"}</span>
              </div>
            </div>
          </section>
          {notes.length > 0 && stage === "inputs" && (
            <div className="intro">
              <div className="intro-inner" role="status">
                <div>
                  <p>Loaded from the annual report. A few things to check:</p>
                  <ul className="notice-list">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
                <button className="linkbtn" onClick={() => setNotes([])}>Hide</button>
              </div>
            </div>
          )}
          <main>
            {(() => {
              const ctx: FinCtx = { m, r, checks, stars, market, set, go };
              if (stage === "inputs") return <FinInputs ctx={ctx} />;
              if (stage === "model") return <FinModel ctx={ctx} />;
              return <FinResults ctx={ctx} />;
            })()}
          </main>
        </>
      )}
      <footer className="foot">
        <span>Valora is a learning tool, not investment advice.</span>
        <span>
          Made by <a href="https://www.linkedin.com/in/evanlatkiewicz/" target="_blank" rel="noreferrer">Evan Latkiewicz</a>.{" "}
          <a href="https://github.com/evanlatkiewicz/dcf-builder">Source on GitHub</a>
        </span>
      </footer>
    </>
  );
}
