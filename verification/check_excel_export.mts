// Writes an export for each test scenario so LibreOffice can recalculate it.
// Run: npx tsx verification/check_excel_export.ts
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildWorkbook } from "../lib/excel.ts";
import { runDcf } from "../lib/dcf.ts";
import { scenarios } from "./make-scenarios.ts";

const dir = new URL("./export/", import.meta.url);
mkdirSync(dir, { recursive: true });
const expected: Record<string, unknown> = {};
for (const [name, inputs] of Object.entries(scenarios)) {
  const wb = buildWorkbook(ExcelJS, inputs);
  writeFileSync(new URL(`${name}.xlsx`, dir), Buffer.from(await wb.xlsx.writeBuffer()));
  const r = runDcf(inputs);
  expected[name] = { wacc: r.wacc.wacc, ev: r.enterpriseValue, equity: r.equityValue, price: r.impliedPrice };
}
writeFileSync(new URL("expected.json", dir), JSON.stringify(expected, null, 2));
console.log("wrote exports");
