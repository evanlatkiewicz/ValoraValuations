// Writes an export for each test scenario so LibreOffice can recalculate it.
// Run: npx tsx verification/check_excel_export.ts
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildWorkbook } from "../lib/excel.ts";
import { runDcf } from "../lib/dcf.ts";
import { scenarios } from "./make-scenarios.ts";
import { caseInputs, getScenarios } from "../lib/scenarios.ts";
import { APPLE } from "../lib/companies.ts";

const dir = new URL("./export/", import.meta.url);
mkdirSync(dir, { recursive: true });
const expected: Record<string, unknown> = {};
for (const [name, inputs] of Object.entries(scenarios)) {
  const wb = buildWorkbook(ExcelJS, inputs);
  writeFileSync(new URL(`${name}.xlsx`, dir), Buffer.from(await wb.xlsx.writeBuffer()));
  const r = runDcf(inputs);
  expected[name] = { wacc: r.wacc.wacc, ev: r.enterpriseValue, equity: r.equityValue, price: r.impliedPrice };
}
// Each case of a model with saved, edited cases, selected by the switch cell
const s0 = getScenarios(APPLE);
const withCases = { ...APPLE, scenarios: { ...s0, bull: { ...s0.bull, capexPct: 0.025, terminalGrowth: 0.034 }, bear: { ...s0.bear, exitMultiple: 11 } } };
for (const id of ["bear", "base", "bull"] as const) {
  const wb = buildWorkbook(ExcelJS, withCases, id);
  writeFileSync(new URL(`case_${id}.xlsx`, dir), Buffer.from(await wb.xlsx.writeBuffer()));
  const r = runDcf(caseInputs(withCases, id));
  expected[`case_${id}`] = { wacc: r.wacc.wacc, ev: r.enterpriseValue, equity: r.equityValue, price: r.impliedPrice };
}
writeFileSync(new URL("expected.json", dir), JSON.stringify(expected, null, 2));
console.log("wrote exports");
