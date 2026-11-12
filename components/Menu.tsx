"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { APPLE } from "@/lib/companies";
import { shareUrl } from "@/lib/share";
import { publicOrigin } from "@/lib/site";
import { loadSession } from "@/lib/session";
import type { DcfInputs } from "@/lib/types";
import type { ScenarioId } from "@/lib/scenarios";

/**
 * The site menu. On the builder it receives the live model; on the Learn and
 * About pages it falls back to the model saved for this browser tab.
 */
export function Menu({ inputs, canExport = true, scenario = "base" }: { inputs?: DcfInputs; canExport?: boolean; scenario?: ScenarioId }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
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

  const model = () => inputs ?? loadSession()?.inputs ?? APPLE;

  const share = async () => {
    const url = await shareUrl(publicOrigin(), model());
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      window.prompt("Copy this link", url);
    }
    setOpen(false);
  };

  const download = async () => {
    setOpen(false);
    setStatus("Building spreadsheet");
    try {
      const [{ default: ExcelJS }, { buildWorkbook, workbookName }] = await Promise.all([
        import("exceljs"),
        import("@/lib/excel"),
      ]);
      const m = model();
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
    <Link href={href} role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
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
        onClick={() => setOpen((o) => !o)}
      >
        <span className="menu-icon" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        Menu
      </button>
      {open && (
        <div className="menu-panel" role="menu">
          <div className="menu-group">
            <div className="menu-label">This model</div>
            <button role="menuitem" className="menu-item" onClick={share} disabled={!canExport}>
              Copy share link
            </button>
            <button role="menuitem" className="menu-item" onClick={download} disabled={!canExport}>
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
