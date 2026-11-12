import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, OUTPUT_CELLS, workbookName } from "./excel";
import { APPLE } from "./companies";

describe("Excel export", () => {
  it("writes live formulas and the user's inputs", async () => {
    const wb = buildWorkbook(ExcelJS, { ...APPLE, terminalGrowth: 0.025 });
    const ws = wb.getWorksheet("DCF")!;
    expect(ws.getCell("C18").value).toBe(0.025); // terminal growth input
    expect((ws.getCell(OUTPUT_CELLS.price).value as { formula: string }).formula).toBe("C55/C56");
    expect((ws.getCell(OUTPUT_CELLS.wacc).value as { formula: string }).formula).toContain("C45");
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(5000);
  });
  it("names the file after the company", () => {
    expect(workbookName(APPLE)).toBe("Valora_AAPL_FY2026.xlsx");
  });
});
