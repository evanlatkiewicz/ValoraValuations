"use client";

import { useEffect, useId, useRef, useState } from "react";
import { resolveTyped, type SearchHit } from "@/lib/search";

const cache = new Map<string, SearchHit[]>();

/**
 * Ticker box with company-name search. Type "KO" or "coca cola"; matching
 * companies drop down below and Enter loads the highlighted one.
 */
export function TickerSearch({
  id,
  size,
  value,
  onChange,
  onSubmit,
  button,
  busy,
  placeholder,
  autoFocus,
  describedBy,
}: {
  id: string;
  size: "large" | "small";
  value: string;
  onChange: (v: string) => void;
  onSubmit: (ticker: string) => void;
  button: string;
  busy?: boolean;
  placeholder: string;
  autoFocus?: boolean;
  describedBy?: string;
}) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  // Look up matches as the person types, with a short pause between keys.
  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const key = q.toLowerCase();
    const cached = cache.get(key);
    if (cached) {
      setHits(cached);
      setActive(-1);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { results: SearchHit[] };
        cache.set(key, json.results ?? []);
        setHits(json.results ?? []);
        setActive(-1);
      } catch {
        /* aborted or offline: keep the box usable as a plain ticker field */
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (ticker: string) => {
    setOpen(false);
    setActive(-1);
    onChange(ticker);
    onSubmit(ticker);
  };

  const submit = () => {
    if (!value.trim()) return;
    pick(active >= 0 && hits[active] ? hits[active].ticker : resolveTyped(value, hits));
  };

  const show = open && hits.length > 0 && value.trim().length > 0 && !busy;
  const large = size === "large";

  return (
    <form
      ref={wrap}
      className={large ? "start-form" : "ticker-form"}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={`ts-wrap ${large ? "ts-large" : "ts-small"}`}>
        <label htmlFor={id} className="sr-only">Ticker or company name</label>
        <input
          ref={input}
          id={id}
          className={large ? "start-input" : "ticker-input"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && hits.length) {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (a + 1) % hits.length);
            } else if (e.key === "ArrowUp" && hits.length) {
              e.preventDefault();
              setActive((a) => (a <= 0 ? hits.length - 1 : a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
          }}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          disabled={busy}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={describedBy}
        />
        {show && (
          <ul className="ts-list" id={listId} role="listbox" aria-label="Matching companies">
            {hits.map((h, i) => (
              <li
                key={h.ticker}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`ts-opt ${i === active ? "is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h.ticker)}
              >
                <span className="ts-ticker">{h.ticker}</span>
                <span className="ts-name">{h.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className={large ? "btn start-btn" : "btn small"} type="submit" disabled={!!busy || !value.trim()}>
        {button}
      </button>
    </form>
  );
}
