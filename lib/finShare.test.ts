import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decodeFin, encodeFin, finShareUrl } from "./finShare";
import { finCardQuery, readFinCard, summarizeFin } from "./og";
import { equityFromFacts } from "./secFin";
import { buildFinSnapshot } from "./finSnapshot";
import type { CompanyFacts } from "./sec";

const facts = JSON.parse(readFileSync(new URL("./fixtures/JPM.json", import.meta.url), "utf8")) as CompanyFacts;
const M = { ...equityFromFacts(facts, "JPM").inputs, sharePrice: 300, company: { ...equityFromFacts(facts, "JPM").inputs.company, logo: "https://api.twelvedata.com/logo/jpmorganchase.com" } };

describe("bank model share links", () => {
  it("round-trips the model", async () => {
    expect(await decodeFin(await encodeFin(M))).toEqual(M);
    expect(await finShareUrl("https://x.com", M)).toMatch(/^https:\/\/x\.com\/financials\?f=z/);
  });
  it("rejects bad tokens and strips untrusted links", async () => {
    expect(await decodeFin("zzz")).toBeNull();
    expect(await decodeFin(await encodeFin({ ...M, roe: [0.1, 0.1] }))).toBeNull();
    const bad = await decodeFin(await encodeFin({ ...M, sources: { ...M.sources, history: { kind: "filing", note: "x", url: "javascript:alert(1)" } } }));
    expect(bad?.sources.history.url).toBeUndefined();
  });
  it("builds a preview card", () => {
    const c = summarizeFin(M)!;
    const back = readFinCard(new URLSearchParams(finCardQuery(c)))!;
    expect(back.value).toBeCloseTo(c.value, 2);
    expect(back.kind).toBe("bank");
    expect(back.logo).toBe("jpmorganchase.com");
  });
});

describe("bank snapshot data", () => {
  it("adds up book value and excess returns to the value per share", () => {
    const d = buildFinSnapshot({ model: M, market: null, curve: null, tenYear: 0.045, peers: [], earnings: null, dps: 5.8, today: "2026-11-12" });
    expect(d.valuation.parts.book + d.valuation.parts.excess + d.valuation.parts.terminal).toBeCloseTo(d.valuation.value, 8);
    expect(d.trends).toHaveLength(M.history.length + 5);
    expect(d.quote.divYield).toBeCloseTo(5.8 / 300, 8);
  });
});
