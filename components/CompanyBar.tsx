"use client";

import { useState } from "react";
import type { DcfInputs } from "@/lib/types";
import { price } from "@/lib/format";

/** Company logo, or the first letter of its name when there's no logo. */
export function CompanyLogo({ name, logo, size = 52 }: { name: string; logo?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="co-logo" src={logo} alt="" width={size} height={size} onError={() => setFailed(true)} />
    );
  }
  return (
    <span className="co-logo co-mono" style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** The band under the header that says which company you're looking at. */
export function CompanyBar({ inputs, logo }: { inputs: DcfInputs; logo?: string | null }) {
  const c = inputs.company;
  if (!c.name.trim()) return null;
  const filing = inputs.sources.history?.url;
  return (
    <section className="co-bar" aria-label="Company">
      <div className="co-inner">
        <CompanyLogo name={c.name} logo={logo ?? c.logo} />
        <div className="co-text">
          <h2 className="co-name">{c.name}</h2>
          <div className="co-meta">
            {c.ticker && <span className="co-ticker">{c.ticker}</span>}
            <span>Base year {c.baseYearLabel}{filing ? ", " : ""}{filing && <a href={filing} target="_blank" rel="noreferrer">10-K filing</a>}</span>
          </div>
        </div>
        {inputs.sharePrice > 0 && (
          <div className="co-price">
            <span className="co-price-label">Share price{c.priceDate ? `, ${c.priceDate}` : ""}</span>
            <span className="co-price-value">{price(inputs.sharePrice)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
