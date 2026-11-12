"use client";

import { useEffect, useRef } from "react";

const PICKS = ["AAPL", "MSFT", "NVDA", "COST", "KO", "NKE"];

const STEPS: [string, string][] = [
  ["Inputs", "Check the numbers pulled from the 10-K and set your assumptions, one step at a time."],
  ["Model", "See every line of the DCF compiled, and click any number to see its formula."],
  ["Valuation", "Get a value per share with bull, base and bear cases, sensitivity tables and sanity checks."],
];

export function StartScreen({
  ticker,
  setTicker,
  onLoad,
  loading,
  error,
  onBlank,
  resume,
}: {
  ticker: string;
  setTicker: (t: string) => void;
  onLoad: (t: string) => void;
  loading: string | null;
  error: string | null;
  onBlank: () => void;
  resume: { name: string; go: () => void } | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <main className="start">
      <div className="start-inner">
        <h1 className="start-title">Let&rsquo;s get started.</h1>
        <p className="start-lede">
          Enter a stock ticker. Valora pulls the company&rsquo;s last three years from its 10-K, adds today&rsquo;s share price, and walks
          you through valuing it.
        </p>

        <form
          className="start-form"
          onSubmit={(e) => {
            e.preventDefault();
            onLoad(ticker);
          }}
        >
          <label htmlFor="start-ticker" className="sr-only">Ticker symbol</label>
          <input
            ref={input}
            id="start-ticker"
            className="start-input"
            placeholder="Ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            autoComplete="off"
            spellCheck={false}
            maxLength={10}
            disabled={!!loading}
            aria-describedby="start-hint"
          />
          <button className="btn start-btn" type="submit" disabled={!!loading || !ticker.trim()}>
            {loading ? "Loading" : "Value this company"}
          </button>
        </form>

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
              {PICKS.map((t) => (
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
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <span className="start-n">{i + 1}</span>
              <div>
                <div className="start-step-t">{t}</div>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="start-blank">
          Prefer to type in the numbers yourself?{" "}
          <button className="linkbtn" onClick={onBlank}>Start from a blank model</button>
        </p>
      </div>
    </main>
  );
}
