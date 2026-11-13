"use client";

import { TickerSearch } from "./TickerSearch";

export interface StartCopy {
  title: string;
  lede: string;
  button: string;
  picks: string[];
  steps: [string, string][];
  blank?: string; // text before the blank-model link; omit to hide it
}

export const DCF_COPY: StartCopy = {
  title: "Let\u2019s get started.",
  lede: "Enter a ticker or start typing a company name. Valora pulls the company\u2019s last three years from its 10-K, adds today\u2019s share price, and walks you through valuing it.",
  button: "Value this company",
  picks: ["AAPL", "MSFT", "NVDA", "COST", "KO", "NKE"],
  steps: [
    ["Inputs", "Check the numbers pulled from the 10-K and set your assumptions, one step at a time."],
    ["Model", "See every line of the DCF compiled, and click any number to see its formula."],
    ["Valuation", "Get a value per share with bull, base and bear cases, sensitivity tables and sanity checks."],
  ],
  blank: "Prefer to type in the numbers yourself?",
};

export function StartScreen({
  ticker,
  setTicker,
  onLoad,
  loading,
  error,
  onBlank,
  resume,
  copy = DCF_COPY,
}: {
  copy?: StartCopy;
  ticker: string;
  setTicker: (t: string) => void;
  onLoad: (t: string) => void;
  loading: string | null;
  error: string | null;
  onBlank?: () => void;
  resume: { name: string; go: () => void } | null;
}) {

  return (
    <main className="start">
      <div className="start-inner">
        <h1 className="start-title">{copy.title}</h1>
        <p className="start-lede">{copy.lede}</p>

        <TickerSearch
          id="start-ticker"
          size="large"
          value={ticker}
          onChange={setTicker}
          onSubmit={onLoad}
          button={loading ? "Loading" : copy.button}
          busy={!!loading}
          placeholder="Ticker or company name"
          autoFocus
          describedBy="start-hint"
        />

        <div id="start-hint" className="start-status" aria-live="polite">
          {loading ? (
            <span className="start-loading">
              <span className="start-spinner" aria-hidden />
              {loading}
            </span>
          ) : error ? (
            <span className="start-error">{error}</span>
          ) : (
            <span className="start-picks">
              Or try one:
              {copy.picks.map((t) => (
                <button key={t} type="button" className="pick" onClick={() => onLoad(t)}>
                  {t}
                </button>
              ))}
            </span>
          )}
        </div>

        {resume && !loading && (
          <p className="start-resume">
            <button className="linkbtn" onClick={resume.go}>Go back to {resume.name}</button>
          </p>
        )}

        <ol className="start-steps" aria-label="What happens next">
          {copy.steps.map(([t, d], i) => (
            <li key={t}>
              <span className="start-n">{i + 1}</span>
              <div>
                <div className="start-step-t">{t}</div>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>

        {copy.blank && onBlank && (
          <p className="start-blank">
            {copy.blank}{" "}
            <button className="linkbtn" onClick={onBlank}>Start from a blank model</button>
          </p>
        )}
      </div>
    </main>
  );
}
