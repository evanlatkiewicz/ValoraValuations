"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { shareUrl } from "@/lib/share";
import { publicOrigin } from "@/lib/site";
import { loadSession } from "@/lib/session";
import type { DcfInputs } from "@/lib/types";
import type { ScenarioId } from "@/lib/scenarios";
import type { OptionModel } from "@/lib/optionModel";

/**
 * The site menu. On the builder it receives the live model; on the Learn and
 * About pages it falls back to the model saved for this browser tab.
 */
export function Menu({
  inputs,
  canExport = true,
  scenario = "base",
  optionModel,
}: {
  inputs?: DcfInputs;
  canExport?: boolean;
  scenario?: ScenarioId;
  /** Set on the options page. Sharing and Excel for options come later. */
  optionModel?: OptionModel | null;
}) {
  const onOptions = optionModel !== undefined;
  // "closing" keeps the panel on screen while its exit animation plays
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const open = phase === "open";
  const [available, setAvailable] = useState(false);
  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const close = () => setPhase((p) => (p === "open" ? (reduced() ? "closed" : "closing") : p));
  const toggle = () => {
    if (phase === "open") return close();
    setAvailable(onOptions ? false : inputs ? canExport : !!loadSession()?.inputs);
    setPhase("open");
  };
  const [status, setStatus] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const model = () => inputs ?? loadSession()?.inputs ?? null;

  const share = async () => {
    const m = model();
    if (!m) return;
    const url = await shareUrl(publicOrigin(), m);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
    close();
  };

  const download = async () => {
    close();
    setStatus("Building spreadsheet");
    try {
      const [{ default: ExcelJS }, { buildWorkbook, workbookName }] = await Promise.all([
        import("exceljs"),
        import("@/lib/excel"),
      ]);
      const m = model();
      if (!m) throw new Error("no model");
      const buf = await buildWorkbook(ExcelJS, m, scenario).xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = workbookName(m);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("Spreadsheet downloaded");
    } catch {
      setStatus("Couldn't build the spreadsheet");
    }
  };

  const item = (href: string, text: string) => (
    <Link href={href} role="menuitem" className="menu-item" onClick={() => close()}>
      {text}
    </Link>
  );

  return (
    <div className="menu" ref={wrap}>
      {status && <span className="share-note" role="status">{status}</span>}
      <button
        ref={button}
        className="btn ghost small menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="menu-icon" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        Menu
      </button>
      {phase !== "closed" && (
        <div
          className="menu-panel"
          role="menu"
          data-state={phase}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && phase === "closing") setPhase("closed");
          }}
        >
          <div className="menu-group">
            <div className="menu-label">This model</div>
            <button role="menuitem" className="menu-item" onClick={share} disabled={!available}>
              Copy share link
            </button>
            <button role="menuitem" className="menu-item" onClick={download} disabled={!available}>
              Download in Excel
            </button>
          </div>
          <div className="menu-group">
            <div className="menu-label">Learn</div>
            {item("/learn/how-a-dcf-works", "How a DCF works")}
            {item("/learn/glossary", "Glossary")}
            {item("/learn/interview-questions", "Common interview questions")}
          </div>
          <div className="menu-group">
            <div className="menu-label">About</div>
            {item("/about", "How Valora works")}
            {item("/disclaimer", "Disclaimer")}
            {item("/contact", "Contact")}
          </div>
        </div>
      )}
    </div>
  );
}
