// Writes options exports for several contracts plus the engine's numbers,
// so LibreOffice can recalculate the workbooks and compare_options_export.py can check them.
// Run: npx tsx verification/check_options_export.mts
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildOptionWorkbook } from "../lib/optionsExcel.ts";
import { runOption, type OptionModel } from "../lib/optionModel.ts";
import { blackScholes } from "../lib/options.ts";

const base: OptionModel = {
  ticker: "TEST", name: "Test Co", type: "call", S: 100, priceDate: "2026-11-12", K: 100, expiry: "2027-05-21",
  valuationDate: "2026-11-12", sigma: 0.25, histVol: 0.24, histDays: 251, treasury: 0.045, treasuryDate: "2026-11-10",
  q: 0.015, dps: 1.5, marketPrice: null, sources: {},
};
const cases: Record<string, OptionModel> = {
  atm_call: base,
  otm_put: { ...base, type: "put", K: 85, sigma: 0.4, q: 0 },
  itm_call_short: { ...base, K: 80, expiry: "2026-11-27", sigma: 0.18 },
  deep_put_long: { ...base, type: "put", S: 354.91, K: 420, expiry: "2028-01-21", sigma: 0.31, treasury: 0.0498, q: 0.004 },
  expiry_day: { ...base, expiry: "2026-11-12" },
};
const dir = new URL("./export-options/", import.meta.url);
mkdirSync(dir, { recursive: true });
const expected: Record<string, unknown> = {};
for (const [name, m] of Object.entries(cases)) {
  writeFileSync(new URL(`${name}.xlsx`, dir), Buffer.from(await buildOptionWorkbook(ExcelJS, m).xlsx.writeBuffer()));
  const r = runOption(m).result;
  const R = r;
  // Sensitivity centre cell must equal the focused price; corner checks the grid formula
  const corner = blackScholes({ ...runOption(m).inputs, S: m.S * 0.9, sigma: Math.max(0.01, m.sigma - 0.1) });
  expected[name] = {
    call: R.call, put: R.put, d1: R.d1, d2: R.d2,
    callDelta: R.callGreeks.delta, putDelta: R.putGreeks.delta, gamma: R.callGreeks.gamma, vega: R.callGreeks.vega,
    callTheta: R.callGreeks.theta, putTheta: R.putGreeks.theta, callRho: R.callGreeks.rho, putRho: R.putGreeks.rho,
    parity: 0,
    sensCentre: m.type === "call" ? R.call : R.put,
    sensCorner: m.type === "call" ? corner.call : corner.put,
  };
}
writeFileSync(new URL("expected.json", dir), JSON.stringify(expected, null, 2));
console.log("wrote", Object.keys(cases).length, "workbooks");
