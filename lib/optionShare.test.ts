import { describe, expect, it } from "vitest";
import { decodeOption, encodeOption, optionShareUrl } from "./optionShare";
import { optionCardQuery, readOptionCard, summarizeOption } from "./og";
import type { OptionModel } from "./optionModel";

const M: OptionModel = {
  ticker: "AAPL", name: "Apple Inc.", logo: "https://api.twelvedata.com/logo/apple.com", type: "put", S: 354.91,
  priceDate: "2026-11-12", K: 355, expiry: "2027-02-19", valuationDate: "2026-11-12", sigma: 0.2496, histVol: 0.2496,
  histDays: 251, treasury: 0.0498, treasuryDate: "2026-11-10", q: 0.0029, dps: 1.04, marketPrice: 16.2,
  sources: { S: "Last close on Nov 12, 2026, from Twelve Data." },
};

describe("options share links", () => {
  it("round-trips a contract", async () => {
    expect(await decodeOption(await encodeOption(M))).toEqual(M);
    const url = await optionShareUrl("https://example.com", M);
    expect(url).toMatch(/^https:\/\/example\.com\/options\?o=z/);
    expect(url.length).toBeLessThan(800);
  });

  it("rejects tampered or foreign tokens", async () => {
    expect(await decodeOption("zzzz")).toBeNull();
    expect(await decodeOption("abc")).toBeNull();
    expect(await decodeOption(await encodeOption({ ...M, type: "straddle" as never }))).toBeNull();
    expect(await decodeOption(await encodeOption({ ...M, expiry: "soon" }))).toBeNull();
    const bad = await decodeOption(await encodeOption({ ...M, logo: "https://evil.example/x.png" }));
    expect(bad?.logo).toBeUndefined();
  });

  it("builds a preview card both prices can be read back from", () => {
    const card = summarizeOption(M)!;
    expect(card.type).toBe("put");
    const back = readOptionCard(new URLSearchParams(optionCardQuery(card)))!;
    expect(back.call).toBeCloseTo(card.call, 2);
    expect(back.put).toBeCloseTo(card.put, 2);
    expect(back.logo).toBe("apple.com");
    expect(readOptionCard(new URLSearchParams("n=x&v=1&p=2"))).toBeNull(); // a DCF card isn't an options card
  });
});
