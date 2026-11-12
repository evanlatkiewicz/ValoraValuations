"use client";

import { useState, type ReactNode } from "react";
import type { Level } from "@/lib/checks";
import type { Source } from "@/lib/types";

export type NumKind = "pct" | "money" | "price" | "mult" | "num" | "shares";

function toText(v: number, kind: NumKind): string {
  if (!isFinite(v)) return "";
  switch (kind) {
    case "pct":
      return String(Number((v * 100).toFixed(2)));
    case "money":
    case "shares":
      return v.toLocaleString("en-US", { maximumFractionDigits: kind === "shares" ? 3 : 0 });
    case "price":
      return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "mult":
      return String(Number(v.toFixed(2)));
    default:
      return String(Number(v.toFixed(4)));
  }
}

function toEdit(v: number, kind: NumKind): string {
  if (!isFinite(v)) return "";
  if (kind === "pct") return String(Number((v * 100).toFixed(4)));
  return String(Number(v.toFixed(4)));
}

function parse(s: string, kind: NumKind): number | null {
  let t = s.trim().replace(/[$,%x\s]/gi, "");
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  if (!isFinite(n)) return null;
  const v = neg ? -n : n;
  return kind === "pct" ? v / 100 : v;
}

const AFFIX: Record<NumKind, { pre?: string; post?: string }> = {
  pct: { post: "%" },
  money: { pre: "$", post: "M" },
  price: { pre: "$" },
  mult: { post: "x" },
  num: {},
  shares: { post: "M" },
};

export function NumInput({
  value,
  onChange,
  kind,
  label,
  level,
}: {
  value: number;
  onChange: (n: number) => void;
  kind: NumKind;
  label: string;
  level?: Level | null;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const a = AFFIX[kind];
  return (
    <span className={`num-input ${level && level !== "good" ? `lvl-${level}` : ""}`}>
      {a.pre && <span className="affix pre">{a.pre}</span>}
      <input
        inputMode="decimal"
        aria-label={label}
        value={draft ?? toText(value, kind)}
        onFocus={(e) => {
          setDraft(toEdit(value, kind));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parse(e.target.value, kind);
          if (n !== null) onChange(n);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {a.post && <span className="affix post">{a.post}</span>}
    </span>
  );
}

const SOURCE_LABEL: Record<Source["kind"], string> = {
  filing: "📄 From filing",
  market: "📈 Market data",
  assumption: "🧭 Assumption",
  user: "✏️ Your input",
};

export function SourceTag({ source }: { source?: Source }) {
  if (!source) return null;
  return (
    <span className="src">
      <span className={`src-kind ${source.kind}`}>{SOURCE_LABEL[source.kind]}</span>
      {source.url && (
        <a href={source.url} target="_blank" rel="noreferrer">
          view source
        </a>
      )}
    </span>
  );
}

export function SourceNote({ source }: { source?: Source }) {
  if (!source?.note) return null;
  return <span>{source.note}</span>;
}

const LEVEL_WORD: Record<Level, string> = {
  good: "Looks reasonable",
  warn: "Worth a second look",
  bad: "Likely a problem",
};

export function Dot({ level }: { level: Level | null }) {
  if (!level) return <span className="dot none" role="img" aria-label="Not filled in yet" title="Not filled in yet" />;
  return <span className={`dot ${level}`} role="img" aria-label={LEVEL_WORD[level]} title={LEVEL_WORD[level]} />;
}

export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  const path =
    "M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z";
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        const id = `half-${i}-${size}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
            <defs>
              <clipPath id={id}>
                <rect x="0" y="0" width={20 * fill} height="20" />
              </clipPath>
            </defs>
            <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.2" />
            <path d={path} fill="var(--ink)" clipPath={`url(#${id})`} />
          </svg>
        );
      })}
    </span>
  );
}

export function Field({
  label,
  help,
  dot,
  input,
  notes,
  wide,
}: {
  wide?: boolean;
  label: string;
  help?: ReactNode;
  dot?: Level | null;
  input: ReactNode;
  notes?: ReactNode;
}) {
  return (
    <div className={wide ? "field wide" : "field"}>
      <div>
        <div className="field-label">
          {dot !== undefined && <Dot level={dot} />}
          {label}
        </div>
        {help && <div className="field-help">{help}</div>}
      </div>
      <div>{input}</div>
      <div className="field-notes">{notes}</div>
    </div>
  );
}

/** The Valora mark: five bars getting shorter, which is what discounting does. */
export function Mark({ size = 26 }: { size?: number }) {
  const bars = [1, 0.82, 0.67, 0.55, 0.45];
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <rect x="0.75" y="0.75" width="24.5" height="24.5" rx="2" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="1.5" />
      {bars.map((h, i) => (
        <rect key={i} x={4 + i * 3.8} y={21 - 16 * h} width="2.4" height={16 * h} fill={i === 0 ? "var(--green)" : "var(--ink)"} />
      ))}
    </svg>
  );
}
