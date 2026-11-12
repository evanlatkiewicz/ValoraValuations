import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { latestObservation, rfNote, FALLBACK_RF } from "./rates";
import { inputsFromFacts, type CompanyFacts } from "./sec";

describe("risk-free rate", () => {
  it("takes the latest real observation and skips holidays", () => {
    const json = {
      observations: [
        { date: "2026-11-11", value: "." }, // holiday
        { date: "2026-11-10", value: "4.12" },
        { date: "2026-11-09", value: "4.10" },
      ],
    };
    expect(latestObservation(json)).toEqual({ date: "2026-11-10", value: 4.12 });
  });

  it("ignores bad responses", () => {
    expect(latestObservation({ error_code: 400 })).toBeNull();
    expect(latestObservation({ observations: [{ date: "x", value: "4" }] })).toBeNull();
  });

  it("writes a dated note for a live rate", () => {
    expect(rfNote({ rate: 0.0412, date: "2026-11-10", source: "FRED (DGS10)", live: true })).toContain("Nov 10, 2026");
    expect(rfNote(FALLBACK_RF)).toContain("Check today's yield");
  });

  it("loads companies with the live rate when one is given", () => {
    const f = JSON.parse(readFileSync(new URL("./fixtures/KO.json", import.meta.url), "utf8")) as CompanyFacts;
    const { inputs } = inputsFromFacts(f, "KO", { rate: 0.0412, date: "2026-11-10", source: "FRED (DGS10)", live: true });
    expect(inputs.riskFreeRate).toBe(0.0412);
    expect(inputs.preTaxCostOfDebt).toBeCloseTo(0.0562, 6);
    expect(inputs.sources.riskFreeRate.note).toContain("FRED");
  });
});
