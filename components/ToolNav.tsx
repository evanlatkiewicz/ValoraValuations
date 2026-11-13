"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOLS } from "@/lib/tools";

/** Switch between Valora's instruments. Tools that aren't built yet show as "soon". */
export function ToolNav() {
  const path = usePathname();
  return (
    <nav className="tool-nav" aria-label="Instruments">
      {TOOLS.filter((t) => t.id !== "bonds").map((t) =>
        t.ready ? (
          <Link key={t.id} href={t.href} className="tool-link" aria-current={path.startsWith(t.href) || (t.id === "dcf" && path.startsWith("/financials")) ? "page" : undefined}>
            {t.name}
          </Link>
        ) : (
          <span key={t.id} className="tool-link is-soon" aria-disabled="true">
            {t.name} <span className="soon">soon</span>
          </span>
        ),
      )}
    </nav>
  );
}
