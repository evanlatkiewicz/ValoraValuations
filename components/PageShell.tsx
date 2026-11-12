"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Menu } from "./Menu";
import { Mark } from "./ui";

const NAV: { group: string; items: [string, string][] }[] = [
  {
    group: "Learn",
    items: [
      ["/learn/how-a-dcf-works", "How a DCF works"],
      ["/learn/glossary", "Glossary"],
      ["/learn/interview-questions", "Common interview questions"],
    ],
  },
  {
    group: "About",
    items: [
      ["/about", "How Valora works"],
      ["/disclaimer", "Disclaimer"],
      ["/contact", "Contact"],
    ],
  },
];

export function PageShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <>
      <header className="top">
        <div className="top-inner page-top-inner">
          <Link className="brand" href="/">
            <Mark />
            <span className="brand-name">Valora</span>
          </Link>
          <Link className="back-link" href="/">Back to your model</Link>
          <Menu />
        </div>
      </header>
      <div className="doc">
        <nav className="doc-nav" aria-label="Pages">
          <ol>
            {NAV.map((g) => (
              <li key={g.group}>
                <div className="group">{g.group}</div>
                <ol>
                  {g.items.map(([href, text]) => (
                    <li key={href}>
                      <Link href={href} aria-current={path === href ? "page" : undefined}>{text}</Link>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </nav>
        <article className="prose">{children}</article>
      </div>
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
