"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { baseYear, runDcf } from "@/lib/dcf";
import { runChecks, starRating, type Check } from "@/lib/checks";
import { blankInputs } from "@/lib/companies";
import { StartScreen } from "./StartScreen";
import { decodeAny, decodeInputs } from "@/lib/share";
import { loadSession, saveSession } from "@/lib/session";
import { Menu } from "./Menu";
import { analyze, caseInputs, getScenarios, isCaseField, SCENARIO_LABEL, type Analysis, type ScenarioId, type Weights } from "@/lib/scenarios";
import { CompanyBar } from "./CompanyBar";
import { onPrivateDeployment, PUBLIC_ORIGIN } from "@/lib/site";
import type { MarketData } from "@/lib/market";
import { withBeta, withPrice, withRf } from "@/lib/applyMarket";
import type { RiskFree } from "@/lib/rates";
import type { DcfInputs, DcfResult } from "@/lib/types";
import { Mark } from "./ui";
import Link from "next/link";
import { TickerSearch } from "./TickerSearch";
import { ToolNav } from "./ToolNav";
import { InputsStage } from "./InputsStage";
import { ModelStage } from "./ModelStage";
import { ResultsStage } from "./ResultsStage";

export type Stage = "inputs" | "model" | "results";

export interface Ctx {
  inputs: DcfInputs; // the case being viewed (base, bull or bear)
  raw: DcfInputs; // the whole model, including saved cases
  scenario: ScenarioId;
  setScenario: (s: ScenarioId) => void;
  analysis: Analysis | null;
  setWeights: (w: Weights) => void;
  resetCases: () => void;
  result: DcfResult;
  checks: Check[];
  stars: number;
  ready: boolean;
  missing: string[];
  update: (patch: Partial<DcfInputs>, fields: string[]) => void;
  go: (stage: Stage, step?: number) => void;
  market: MarketData | null;
  marketError: string | null;
  applyPrice: () => void;
  applyBeta: () => void;
  rf: RiskFree | null;
  applyRf: () => void;
}

const STAGES: { id: Stage; label: string }[] = [
  { id: "inputs", label: "Inputs" },
  { id: "model", label: "Model" },
  { id: "results", label: "Valuation" },
];

function missingFields(inputs: DcfInputs): string[] {
  const m: string[] = [];
  if (!(baseYear(inputs).revenue > 0)) m.push("Base year revenue");
  if (!(inputs.sharesOutstanding > 0)) m.push("Shares outstanding");
  if (!(inputs.sharePrice > 0)) m.push("Share price");
  return m;
}

export default function Valora() {
  const [inputs, setInputs] = useState<DcfInputs>(blankInputs);
  const [preset, setPreset] = useState<"blank" | "shared" | "loaded">("blank");
  const [home, setHome] = useState(true); // the "Let's get started" screen
  const [hasModel, setHasModel] = useState(false);
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string; warnings?: string[] } | null>(null);
  const [stage, setStage] = useState<Stage>("inputs");
  const [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState<DcfInputs>(blankInputs);
  const [restored, setRestored] = useState(false);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [privateLink, setPrivateLink] = useState(false);
  const [rf, setRf] = useState<RiskFree | null>(null);
  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((d: RiskFree) => setRf(d))
      .catch(() => setRf(null));
  }, []);
  useEffect(() => setPrivateLink(onPrivateDeployment()), []);

  // Open a shared model from the link, or pick up where this tab left off
  useEffect(() => {
    (async () => {
    const q = new URLSearchParams(window.location.search).get("m");
    const h = window.location.hash;
    const d = q ? await decodeAny(q) : h.startsWith("#m=") ? decodeInputs(h.slice(3)) : null;
    if (d) {
      setInputs(d);
      setBaseline(d);
      setPreset("shared");
      setStage("results");
      setHome(false);
      setHasModel(true);
    } else {
      const saved = loadSession();
      if (saved && saved.preset !== "apple") {
        setInputs(saved.inputs);
        setBaseline(saved.baseline);
        setPreset(saved.preset);
        setHome(saved.home ?? false);
        setHasModel(true);
      }
    }
    setRestored(true);
    })();
  }, []);

  useEffect(() => {
    if (restored && hasModel) saveSession({ inputs, baseline, preset, home });
  }, [inputs, baseline, preset, home, restored, hasModel]);

  const [scenario, setScenarioState] = useState<ScenarioId>("base");
  const scenarioRef = useRef<ScenarioId>("base");
  const setScenario = useCallback((s: ScenarioId) => {
    scenarioRef.current = s;
    setScenarioState(s);
  }, []);

  const view = useMemo(() => caseInputs(inputs, scenario), [inputs, scenario]);
  const result = useMemo(() => runDcf(view), [view]);
  const missing = useMemo(() => missingFields(view), [view]);
  const ready = missing.length === 0;
  const checks = useMemo(() => (ready ? runChecks(view, result) : []), [view, result, ready]);
  const stars = ready ? starRating(checks) : 0;
  const analysis = useMemo(() => (ready ? analyze(inputs) : null), [inputs, ready]);

  const update = useCallback((patch: Partial<DcfInputs>, fieldsIn: string[]) => {
    setInputs((prev) => {
      let fields = fieldsIn;
      const id = scenarioRef.current;
      const caseKeys = Object.keys(patch).filter(isCaseField);
      if (id !== "base" && caseKeys.length) {
        // Bull and bear edits go to that case only
        const sc = getScenarios(prev);
        const vals = { ...sc[id] } as Record<string, unknown>;
        const rest: Record<string, unknown> = { ...patch };
        for (const k of caseKeys) {
          vals[k] = (patch as Record<string, unknown>)[k];
          delete rest[k];
        }
        patch = { ...rest, scenarios: { ...sc, [id]: vals } } as Partial<DcfInputs>;
        fields = fields.filter((f) => !isCaseField(f));
      }
      const sources = { ...prev.sources };
      for (const f of fields) {
        const old = prev.sources[f];
        if (old?.kind === "user") continue;
        sources[f] = {
          kind: "user",
          note: old?.note ? `You changed this. Original: ${old.note}` : undefined,
          url: old?.url,
        };
      }
      const next = { ...prev, ...patch, sources };
      next.company = { ...next.company, baseYearLabel: next.history[next.history.length - 1].label };
      return next;
    });
  }, []);

  const go = useCallback((s: Stage, st?: number) => {
    setStage(s);
    if (st !== undefined) setStep(st);
    window.scrollTo({ top: 0 });
  }, []);

  const startBlank = () => {
    const next = rf?.live ? withRf(blankInputs(), rf) : blankInputs();
    setInputs(next);
    setBaseline(next);
    setPreset("blank");
    setMarket(null);
    setHome(false);
    setHasModel(true);
    setStage("inputs");
    setStep(0);
    setScenario("base");
    setNotice(null);
    history.replaceState(null, "", window.location.pathname);
  };

  const fetchMarket = useCallback(async (t: string): Promise<MarketData | null> => {
    try {
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) {
        setMarketError(data.error ?? "Price data isn't available right now.");
        return null;
      }
      setMarket(data as MarketData);
      setMarketError(null);
      return data as MarketData;
    } catch {
      setMarketError("Price data isn't available right now.");
      return null;
    }
  }, []);

  // Fetch prices for the chart whenever the company changes
  const tickerNow = inputs.company.ticker;
  useEffect(() => {
    if (!restored || !tickerNow || preset === "blank") return;
    if (market?.ticker === tickerNow.toUpperCase()) return;
    setMarket(null);
    fetchMarket(tickerNow);
  }, [tickerNow, preset, restored, market?.ticker, fetchMarket]);

  const applyPrice = () => market && setInputs((prev) => withPrice(prev, market));
  const applyRf = () => rf && setInputs((prev) => withRf(prev, rf));
  const applyBeta = () => market && setInputs((prev) => withBeta(prev, market));

  const loadTicker = async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t || loading) return;
    setTicker(t);
    setLoading(`Reading ${t}'s 10-K`);
    setNotice(null);
    try {
      const res = await fetch(`/api/company?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "error", text: data.error ?? "Something went wrong loading that ticker." });
        return;
      }
      let loaded = data.inputs as DcfInputs;
      setLoading("Getting prices and beta");
      const m = await fetchMarket(loaded.company.ticker);
      if (m) loaded = withBeta(withPrice(loaded, m), m);
      setInputs(loaded);
      setBaseline(loaded);
      setPreset("loaded");
      setScenario("base");
      setStage("inputs");
      setStep(0);
      setHome(false);
      setHasModel(true);
      setTicker("");
      history.replaceState(null, "", window.location.pathname);
      setNotice({
        tone: "info",
        text: m
          ? `Loaded ${loaded.company.name} from its ${loaded.company.baseYearLabel} 10-K, with the latest share price${m.beta ? " and a beta calculated from two years of prices" : ""}. Growth and margins start from the company's recent history, so treat them as a first draft.`
          : `Loaded ${loaded.company.name} from its ${loaded.company.baseYearLabel} 10-K. Growth and margins start from the company's recent history, so treat them as a first draft. Add today's share price in the Balance sheet step to see a value.`,
        warnings: data.warnings,
      });
    } catch {
      setNotice({ tone: "error", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setLoading(null);
    }
  };

  const edited = JSON.stringify(inputs) !== JSON.stringify(baseline);
  const reset = () => {
    setInputs(baseline);
    setNotice(null);
  };

  const setWeights = (w: Weights) =>
    setInputs((prev) => ({ ...prev, scenarios: { ...getScenarios(prev), weights: w } }));
  const resetCases = () =>
    setInputs((prev) => {
      const next = { ...prev };
      delete next.scenarios;
      return next;
    });

  const ctx: Ctx = {
    inputs: view, raw: inputs, scenario, setScenario, analysis, setWeights, resetCases,
    result, checks, stars, ready, missing, update, go, market, marketError, applyPrice, applyBeta, rf, applyRf,
  };
  const name = inputs.company.name || "Untitled company";

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <Link className="brand" href="/">
            <Mark />
            <span className="brand-name">Valora</span>
          </Link>
          <ToolNav />
          {!home ? (
            <div className="company-pick">
              <TickerSearch
                id="ticker"
                size="small"
                value={ticker}
                onChange={setTicker}
                onSubmit={loadTicker}
                button={loading ? "Loading" : "Load"}
                busy={!!loading}
                placeholder="Ticker or company"
              />
              {edited && (
                <button className="linkbtn reset-btn" onClick={reset}>
                  Reset to starting values
                </button>
              )}
              <button className="linkbtn reset-btn" onClick={() => { setHome(true); setNotice(null); window.scrollTo({ top: 0 }); }}>
                New valuation
              </button>
            </div>
          ) : (
            <span />
          )}
          <Menu inputs={hasModel ? inputs : undefined} canExport={hasModel && ready} scenario={scenario} />
        </div>
        {!home && (
          <nav className="stages" aria-label="Stages">
            {STAGES.map((s, i) => (
              <button
                key={s.id}
                className="stage-tab"
                aria-current={stage === s.id ? "page" : undefined}
                onClick={() => go(s.id)}
              >
                <span className="n">{i + 1}</span>
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {privateLink && (
        <div className="private-note" role="note">
          <div className="co-inner">
            You&rsquo;re on a private deployment link, which asks other people to log in to Vercel. Share{" "}
            <a href={PUBLIC_ORIGIN ?? "/"}>{PUBLIC_ORIGIN?.replace("https://", "")}</a> instead. Copy share link in the menu always uses that address.
          </div>
        </div>
      )}

      {home ? (
        <StartScreen
          ticker={ticker}
          setTicker={setTicker}
          onLoad={loadTicker}
          loading={loading}
          error={notice?.tone === "error" ? notice.text : null}
          onBlank={startBlank}
          resume={hasModel ? { name: inputs.company.name || "your model", go: () => setHome(false) } : null}
        />
      ) : (
      <>
      <CompanyBar
        inputs={view}
        logo={market && market.ticker === inputs.company.ticker.toUpperCase() ? market.logo : null}
        scenario={scenario}
        setScenario={setScenario}
      />
      {scenario !== "base" && (
        <div className={`case-note case-${scenario}`} role="status">
          <div className="co-inner">
            <span>
              You&rsquo;re viewing the <strong>{SCENARIO_LABEL[scenario]} case</strong>. Growth, margins, capex and terminal value you change here
              apply only to this case. Everything else is shared by all three cases.
            </span>
            <button className="linkbtn" onClick={() => setScenario("base")}>Back to Base</button>
          </div>
        </div>
      )}

      {notice && (
        <div className="intro">
          <div className={`intro-inner notice-${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            <div>
              <p>{notice.text}</p>
              {notice.warnings && notice.warnings.length > 0 && (
                <ul className="notice-list">
                  {notice.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flex: "none" }}>
              {notice.tone === "info" && !(inputs.sharePrice > 0) && (
                <button className="btn small" onClick={() => { setStage("inputs"); setStep(4); }}>Add share price</button>
              )}
              <button className="linkbtn" onClick={() => setNotice(null)}>Hide</button>
            </div>
          </div>
        </div>
      )}

      <main>
        {stage === "inputs" && <InputsStage ctx={ctx} step={step} setStep={setStep} />}
        {stage === "model" && <ModelStage ctx={ctx} />}
        {stage === "results" && <ResultsStage ctx={ctx} />}
      </main>
      </>
      )}

      <footer className="foot">
        <span>Valora is a learning tool, not investment advice. Check figures against the filings before relying on them.</span>
        <span>
          Made by <a href="https://www.linkedin.com/in/evanlatkiewicz/" target="_blank" rel="noreferrer">Evan Latkiewicz</a>.{" "}
          <a href="https://github.com/evanlatkiewicz/dcf-builder">Source on GitHub</a>
        </span>
      </footer>
    </>
  );
}
