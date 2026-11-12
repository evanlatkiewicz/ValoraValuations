"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { baseYear, runDcf } from "@/lib/dcf";
import { runChecks, starRating, type Check } from "@/lib/checks";
import { APPLE, blankInputs } from "@/lib/companies";
import { decodeInputs, encodeInputs } from "@/lib/share";
import type { DcfInputs, DcfResult } from "@/lib/types";
import { Mark } from "./ui";
import { InputsStage } from "./InputsStage";
import { ModelStage } from "./ModelStage";
import { ResultsStage } from "./ResultsStage";

export type Stage = "inputs" | "model" | "results";

export interface Ctx {
  inputs: DcfInputs;
  result: DcfResult;
  checks: Check[];
  stars: number;
  ready: boolean;
  missing: string[];
  update: (patch: Partial<DcfInputs>, fields: string[]) => void;
  go: (stage: Stage, step?: number) => void;
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
  const [inputs, setInputs] = useState<DcfInputs>(APPLE);
  const [preset, setPreset] = useState<"apple" | "blank" | "shared" | "loaded">("apple");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string; warnings?: string[] } | null>(null);
  const [stage, setStage] = useState<Stage>("inputs");
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // Open a shared model from the link
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith("#m=")) {
      const d = decodeInputs(h.slice(3));
      if (d) {
        setInputs(d);
        setPreset("shared");
        setStage("results");
        setShowIntro(false);
      }
    }
  }, []);

  const result = useMemo(() => runDcf(inputs), [inputs]);
  const missing = useMemo(() => missingFields(inputs), [inputs]);
  const ready = missing.length === 0;
  const checks = useMemo(() => (ready ? runChecks(inputs, result) : []), [inputs, result, ready]);
  const stars = ready ? starRating(checks) : 0;

  const update = useCallback((patch: Partial<DcfInputs>, fields: string[]) => {
    setInputs((prev) => {
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
    setCopied(false);
  }, []);

  const go = useCallback((s: Stage, st?: number) => {
    setStage(s);
    if (st !== undefined) setStep(st);
    window.scrollTo({ top: 0 });
  }, []);

  const choose = (v: string) => {
    if (v === "apple") setInputs(APPLE);
    if (v === "blank") setInputs(blankInputs());
    if (v === "apple" || v === "blank") setPreset(v);
    setStage("inputs");
    setStep(0);
    setCopied(false);
    setNotice(null);
    history.replaceState(null, "", window.location.pathname);
  };

  const loadTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/company?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "error", text: data.error ?? "Something went wrong loading that ticker." });
        return;
      }
      const loaded = data.inputs as DcfInputs;
      setInputs(loaded);
      setPreset("loaded");
      setStage("inputs");
      setStep(0);
      setCopied(false);
      setShowIntro(false);
      history.replaceState(null, "", window.location.pathname);
      setNotice({
        tone: "info",
        text: `Loaded ${loaded.company.name} from its ${loaded.company.baseYearLabel} 10-K. Growth and margins start from the company's recent history, so treat them as a first draft. Add today's share price in the Balance sheet step to see a value.`,
        warnings: data.warnings,
      });
    } catch {
      setNotice({ tone: "error", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#m=${encodeInputs(inputs)}`;
    history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const ctx: Ctx = { inputs, result, checks, stars, ready, missing, update, go };
  const name = inputs.company.name || "Untitled company";

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); choose("apple"); }}>
            <Mark />
            <span className="brand-name">Valora</span>
            <span className="brand-sub">Build a DCF from the ground up</span>
          </a>
          <div className="company-pick">
            <form className="ticker-form" onSubmit={loadTicker} role="search">
              <label htmlFor="ticker" className="sr-only">Ticker symbol</label>
              <input
                id="ticker"
                className="ticker-input"
                placeholder="Ticker, like MSFT"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
                maxLength={10}
              />
              <button className="btn small" type="submit" disabled={loading || !ticker.trim()}>
                {loading ? "Loading" : "Load from SEC"}
              </button>
            </form>
            <select aria-label="Current company" value={preset} onChange={(e) => choose(e.target.value)}>
              <option value="apple">Apple (AAPL), preloaded</option>
              <option value="blank">Start from scratch</option>
              {preset === "loaded" && <option value="loaded">{name} ({inputs.company.ticker}), {inputs.company.baseYearLabel} 10-K</option>}
              {preset === "shared" && <option value="shared">{name} (shared model)</option>}
            </select>
          </div>
          <div className="share">
            {copied && <span className="share-note" role="status">Link copied</span>}
            <button className="btn ghost small" onClick={share} disabled={!ready}>
              Copy share link
            </button>
          </div>
        </div>
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
      </header>

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

      {showIntro && !notice && stage === "inputs" && (
        <div className="intro">
          <div className="intro-inner">
            <p>
              <strong>A discounted cash flow model values a company by the cash it will generate.</strong>{" "}
              Valora walks you through one assumption at a time, compiles the model, then tests it.
              Apple is loaded from its latest 10-K so you can explore. Switch to a blank model when you want to build your own.
            </p>
            <button className="linkbtn" onClick={() => setShowIntro(false)}>Hide</button>
          </div>
        </div>
      )}

      <main>
        {stage === "inputs" && <InputsStage ctx={ctx} step={step} setStep={setStep} />}
        {stage === "model" && <ModelStage ctx={ctx} />}
        {stage === "results" && <ResultsStage ctx={ctx} />}
      </main>

      <footer className="foot">
        <span>Valora is a learning tool, not investment advice. Check figures against the filings before relying on them.</span>
        <span>
          Made by Evan Latkiewicz. <a href="https://github.com/evanlatkiewicz/dcf-builder">Source on GitHub</a>
        </span>
      </footer>
    </>
  );
}
