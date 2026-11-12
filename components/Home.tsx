"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "./Menu";
import { Mark } from "./ui";
import { ToolNav } from "./ToolNav";
import { loadSession } from "@/lib/session";
import { TOOLS } from "@/lib/tools";

export function Home() {
  const router = useRouter();
  const [resume, setResume] = useState<string | null>(null);

  useEffect(() => {
    // The oldest share links kept the model after a #
    if (window.location.hash.startsWith("#m=")) {
      router.replace(`/dcf${window.location.hash}`);
      return;
    }
    const s = loadSession();
    if (s && s.preset !== "apple" && s.inputs.company.name) setResume(s.inputs.company.name);
  }, [router]);

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <Link className="brand" href="/">
            <Mark />
            <span className="brand-name">Valora</span>
          </Link>
          <ToolNav />
          <Menu />
        </div>
      </header>

      <main className="home">
        <div className="home-inner">
          <h1 className="home-title">Valuation, from the ground up.</h1>
          <p className="home-lede">
            Pick what you want to value. Valora pulls live filings and market data, walks you through every assumption, and shows the math
            behind the answer.
          </p>
          {resume && (
            <p className="home-resume">
              <Link href="/dcf">Continue with {resume}</Link>
            </p>
          )}

          <div className="instruments" role="list">
            {TOOLS.map((t) => {
              const body = (
                <>
                  <div className="inst-name">{t.name}</div>
                  <div className="inst-method">{t.method}</div>
                  <p className="inst-blurb">{t.blurb}</p>
                  <div className="inst-go">{t.ready ? "Start" : t.id === "options" ? "Coming next" : "Later"}</div>
                </>
              );
              return t.ready ? (
                <Link key={t.id} href={t.href} className="inst" role="listitem">
                  {body}
                </Link>
              ) : (
                <div key={t.id} className="inst is-soon" role="listitem" aria-disabled="true">
                  {body}
                </div>
              );
            })}
          </div>

          <p className="home-shared">
            Every tool uses live data (SEC filings, Twelve Data prices, FRED Treasury yields), flags assumptions that look off, and exports
            to Excel with working formulas.
          </p>
        </div>
      </main>

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
