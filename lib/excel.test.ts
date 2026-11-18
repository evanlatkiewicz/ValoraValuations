import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, OUTPUT_CELLS, workbookName } from "./excel";
import { APPLE } from "./companies";

describe("Excel export", () => {
  it("writes live formulas and the user's inputs", async () => {
    const wb = buildWorkbook(ExcelJS, { ...APPLE, terminalGrowth: 0.025 });
    const ws = wb.getWorksheet("DCF")!;
    expect(ws.getCell("D56").value).toBe(0.025); // base case terminal growth input
    expect((ws.getCell("C37").value as { formula: string }).formula).toContain("CHOOSE"); // picked by the case switch
    expect((ws.getCell(OUTPUT_CELLS.price).value as { formula: string }).formula).toBe("C96/C97");
    expect((ws.getCell(OUTPUT_CELLS.wacc).value as { formula: string }).formula).toContain("C83");
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(5000);
  });
  it("keeps the sensitivity and scenario sheets live, with no cell fills", () => {
    const wb = buildWorkbook(ExcelJS, APPLE);
    const f = (sheet: string, a: string) => (wb.getWorksheet(sheet)!.getCell(a).value as { formula?: string })?.formula ?? "";
    expect(f("Sensitivity", "F11")).toContain("DCF!");
    expect(f("Sensitivity", "F21")).toContain("SUMPRODUCT");
    for (const a of ["C8", "C9", "C10", "C11", "C12"]) expect(f("Scenarios", a)).not.toBe("");
    wb.eachSheet((ws) => {
      expect(ws.views?.[0]?.showGridLines).not.toBe(false);
      ws.eachRow((row) => row.eachCell((c) => expect(c.fill?.type).toBeUndefined()));
    });
  });
  it("names the file after the company", () => {
    expect(workbookName(APPLE)).toBe("Valora_AAPL_FY2026.xlsx");
  });
});
