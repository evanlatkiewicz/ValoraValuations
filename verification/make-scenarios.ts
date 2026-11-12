// Writes the scenarios that the Excel check workbook is built from.
// Run: npx tsx verification/make-scenarios.ts  (or via vitest setup)
import { writeFileSync } from "node:fs";
import { APPLE } from "../lib/companies";
import type { DcfInputs } from "../lib/types";

export const scenarios: Record<string, DcfInputs> = {
  apple_base: APPLE,
  apple_midyear_exit: { ...APPLE, midYear: true, terminalMethod: "exit", exitMultiple: 16 },
  levered_growth: {
    ...APPLE,
    history: [{ label: "FY2026", revenue: 5000, ebit: 600, da: 200, capex: 260 }],
    baseNwc: 400,
    revenueGrowth: [0.2, 0.16, 0.12, 0.09, 0.06],
    ebitMargin: [0.12, 0.14, 0.15, 0.16, 0.17],
    taxRate: 0.24,
    daPct: 0.04,
    capexPct: 0.05,
    nwcPct: 0.09,
    sharePrice: 42,
    sharesOutstanding: 210,
    cash: 600,
    debt: 3200,
    riskFreeRate: 0.043,
    beta: 1.35,
    equityRiskPremium: 0.05,
    preTaxCostOfDebt: 0.071,
    terminalGrowth: 0.025,
  },
};

if (process.argv[1]?.endsWith("make-scenarios.ts")) {
  writeFileSync(new URL("./scenarios.json", import.meta.url), JSON.stringify(scenarios, null, 2));
  console.log("wrote scenarios.json");
}
