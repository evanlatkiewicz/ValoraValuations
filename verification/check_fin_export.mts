// Writes bank-model exports plus the engine's numbers; compare_fin_export.py checks them after LibreOffice recalculates.
// Run: npx tsx verification/check_fin_export.mts
import ExcelJS from "exceljs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildFinWorkbook } from "../lib/finExcel.ts";
import { runEquity } from "../lib/equity.ts";
import { equityFromFacts } from "../lib/secFin.ts";

const dir = new URL("./export-fin/", import.meta.url);
mkdirSync(dir, { recursive: true });
const expected: Record<string, unknown> = {};
const price: Record<string, number> = { JPM: 300, GS: 750, MET: 80, O: 58, WFC: 80, SCHW: 90 };
for (const t of Object.keys(price)) {
  const f = JSON.parse(readFileSync(new URL(`../lib/fixtures/${t}.json`, import.meta.url), "utf8"));
  const m = { ...equityFromFacts(f, t).inputs, sharePrice: price[t], beta: 1.1 };
  writeFileSync(new URL(`${t}.xlsx`, dir), Buffer.from(await buildFinWorkbook(ExcelJS, m).xlsx.writeBuffer()));
  const r = runEquity(m);
  expected[t] = { costOfEquity: r.costOfEquity, sumPv: r.sumPv, tvPv: r.terminal.pv, equity: r.equityValue, perShare: r.valuePerShare, impliedPb: r.impliedPriceToBook };
}
writeFileSync(new URL("expected.json", dir), JSON.stringify(expected, null, 2));
console.log("wrote", Object.keys(expected).length);
