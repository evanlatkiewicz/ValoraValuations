// Builds the excess return model as an Excel workbook with live formulas.
// Blue cells are inputs, black cells are formulas, same as the other exports.

import type ExcelJSType from "exceljs";
import { equitySensitivity, forecastLabels, runEquity, type EquityInputs } from "./equity";

type ExcelJS = typeof ExcelJSType;

const BLUE = { argb: "FF1F4FBF" };
const INK = { argb: "FF18201C" };
const GRAY = { argb: "FF6B7570" };
const SHADE = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE3E8DB" } };
const MONEY = '#,##0;(#,##0)';
const PCT = "0.00%";
const PRICE = '$#,##0.00;($#,##0.00)';

/** Cell addresses of the key outputs, so tests can read them back. */
export const FIN_CELLS = { costOfEquity: "C14", sumPv: "C28", tvPv: "C31", equity: "C32", perShare: "C33", impliedPb: "C35" };

export function buildFinWorkbook(ExcelJS: ExcelJS, m: EquityInputs) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Valora";
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("Excess return", { views: [{ showGridLines: false }] });
  const cols = ["D", "E", "F", "G", "H"];
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 44;
  ws.getColumn(3).width = 15;
  cols.forEach((_, i) => (ws.getColumn(4 + i).width = 14));
  ws.getColumn(9).width = 70;

  const label = (r: number, t: string, bold = false) => {
    const c = ws.getCell(`B${r}`);
    c.value = t;
    c.font = { bold, color: INK };
  };
  const input = (a: string, v: number, fmt: string) => {
    const c = ws.getCell(a);
    c.value = v;
    c.numFmt = fmt;
    c.font = { color: BLUE };
  };
  const formula = (a: string, f: string, fmt: string, bold = false) => {
    const c = ws.getCell(a);
    c.value = { formula: f };
    c.numFmt = fmt;
    c.font = { color: INK, bold };
  };
  const note = (r: number, t?: string) => {
    if (!t) return;
    const c = ws.getCell(`I${r}`);
    c.value = t;
    c.font = { italic: true, color: GRAY, size: 9 };
  };
  const section = (r: number, t: string) => {
    label(r, t, true);
    ws.getCell(`B${r}`).border = { bottom: { style: "thin", color: INK } };
  };

  ws.getCell("B1").value = `${m.company.name} (${m.company.ticker}): excess return model`;
  ws.getCell("B1").font = { bold: true, size: 14, color: INK };
  ws.getCell("B2").value = `Base year ${m.company.baseYearLabel}. $ in millions except per share. Blue cells are inputs; black cells are formulas. Built with Valora.`;
  ws.getCell("B2").font = { italic: true, color: GRAY };

  section(4, "Inputs");
  label(5, "Common book equity, end of base year"); input("C5", m.bookEquity, MONEY); note(5, m.sources.history?.note);
  label(6, "Shares outstanding (millions)"); input("C6", m.sharesOutstanding, "#,##0.0"); note(6, m.sources.sharesOutstanding?.note);
  label(7, "Share price"); input("C7", m.sharePrice, PRICE); note(7, m.sources.sharePrice?.note);
  label(8, "Risk-free rate"); input("C8", m.riskFreeRate, PCT); note(8, m.sources.riskFreeRate?.note);
  label(9, "Beta"); input("C9", m.beta, "0.00"); note(9, m.sources.beta?.note);
  label(10, "Equity risk premium"); input("C10", m.equityRiskPremium, PCT); note(10, m.sources.equityRiskPremium?.note);
  label(11, "Payout ratio (dividends and buybacks)"); input("C11", m.payoutRatio, PCT); note(11, m.sources.payoutRatio?.note);
  label(12, "Long-run return on equity"); input("C12", m.longRunRoe, PCT); note(12, m.sources.longRunRoe?.note);
  label(13, "Terminal growth"); input("C13", m.terminalGrowth, PCT); note(13, m.sources.terminalGrowth?.note);
  label(14, "Cost of equity", true); formula("C14", "C8+C9*C10", PCT, true); note(14, "Risk-free rate + beta × equity risk premium (CAPM).");

  // Forecast
  const labels = forecastLabels(m.company.baseYearLabel);
  label(16, "Return on equity", true);
  cols.forEach((c, i) => input(`${c}16`, m.roe[i], PCT));
  note(16, m.sources.roe?.note);
  label(17, "Year");
  cols.forEach((c, i) => {
    const cell = ws.getCell(`${c}17`);
    cell.value = i + 1;
    cell.font = { color: GRAY };
  });
  cols.forEach((c, i) => {
    const h = ws.getCell(`${c}15`);
    h.value = labels[i];
    h.font = { bold: true, color: INK };
    h.alignment = { horizontal: "right" };
    h.border = { bottom: { style: "thin", color: INK } };
  });

  const rows: [number, string, (c: string, prev: string | null) => string, string, boolean?][] = [
    [18, "Book equity, start of year", (c, p) => (p ? `${p}22` : "$C$5"), MONEY],
    [19, "Return on equity", (c) => `${c}16`, PCT],
    [20, "Net income", (c) => `${c}18*${c}19`, MONEY],
    [21, "Dividends and buybacks", (c) => `IF(${c}20>0,${c}20*$C$11,0)`, MONEY],
    [22, "Book equity, end of year", (c) => `${c}18+${c}20-${c}21`, MONEY, true],
    [23, "Equity charge (cost of equity × starting book)", (c) => `$C$14*${c}18`, MONEY],
    [24, "Excess return", (c) => `${c}20-${c}23`, MONEY, true],
    [25, "Discount factor", (c) => `1/(1+$C$14)^${c}17`, "0.0000"],
    [26, "Present value", (c) => `${c}24*${c}25`, MONEY, true],
  ];
  for (const [r, t, f, fmt, bold] of rows) {
    label(r, t, !!bold);
    cols.forEach((c, i) => formula(`${c}${r}`, f(c, i ? cols[i - 1] : null), fmt, !!bold));
  }

  section(27, "Value");
  label(28, "Present value of excess returns, years 1 to 5"); formula("C28", "SUM(D26:H26)", MONEY);
  label(29, "Excess return after year 5"); formula("C29", "(C12-C14)*H22", MONEY); note(29, "(Long-run ROE − cost of equity) × book equity at the end of year 5.");
  label(30, "Terminal value"); formula("C30", "C29/(C14-C13)", MONEY); note(30, "Grows at the terminal rate forever: excess return / (cost of equity − growth).");
  label(31, "Present value of terminal value"); formula("C31", "C30*H25", MONEY);
  label(32, "Equity value", true); formula("C32", "C5+C28+C31", MONEY, true); note(32, "Book equity today + PV of excess returns + PV of terminal value.");
  label(33, "Value per share", true); formula("C33", "C32/C6", PRICE, true);
  label(34, "Book value per share"); formula("C34", "C5/C6", PRICE);
  label(35, "Price to book, model"); formula("C35", "C33/C34", '0.00"x"');
  label(36, "Price to book, market"); formula("C36", "C7/C34", '0.00"x"');
  label(37, "Upside to market price"); formula("C37", "C33/C7-1", "0.0%");
  for (const c of ["B", "C"]) for (const r of [32, 33]) ws.getCell(`${c}${r}`).fill = SHADE;

  // History from the filing
  section(39, "Reported history");
  m.history.forEach((h, i) => {
    const col = cols[i] ?? cols.at(-1)!;
    const hc = ws.getCell(`${col}39`);
    hc.value = h.label;
    hc.font = { bold: true, color: INK };
    hc.alignment = { horizontal: "right" };
    input(`${col}40`, h.netIncome, MONEY);
    input(`${col}41`, h.bookEquity, MONEY);
    input(`${col}42`, h.payouts, MONEY);
    formula(`${col}43`, i > 0 ? `${col}40/AVERAGE(${cols[i - 1]}41,${col}41)` : `${col}40/${col}41`, PCT);
  });
  label(40, "Net income to common shareholders");
  label(41, "Common book equity, year end");
  label(42, "Dividends plus buybacks");
  label(43, "Return on equity");

  // Sensitivity (values; the grid is the model run 25 times)
  const ss = wb.addWorksheet("Sensitivity", { views: [{ showGridLines: false }] });
  ss.getColumn(2).width = 18;
  ss.getCell("B1").value = "Value per share: long-run ROE (down) and cost of equity (across)";
  ss.getCell("B1").font = { bold: true, size: 13, color: INK };
  ss.getCell("B2").value = "Values from Valora at the assumptions in this file. Change inputs on the first sheet to see the main value update.";
  ss.getCell("B2").font = { italic: true, color: GRAY };
  const dR = [-0.02, -0.01, 0, 0.01, 0.02];
  const dK = [-0.01, -0.005, 0, 0.005, 0.01];
  const grid = equitySensitivity(m, dR, dK);
  const ke = runEquity(m).costOfEquity;
  dK.forEach((d, j) => {
    const c = ss.getCell(4, 3 + j);
    c.value = ke + d;
    c.numFmt = "0.0%";
    c.font = { bold: true };
    c.fill = SHADE;
  });
  dR.forEach((d, i) => {
    const h = ss.getCell(5 + i, 2);
    h.value = m.longRunRoe + d;
    h.numFmt = "0.0%";
    h.font = { bold: true };
    h.fill = SHADE;
    grid[i].forEach((v, j) => {
      const c = ss.getCell(5 + i, 3 + j);
      c.value = Number.isFinite(v) ? v : "n/a";
      c.numFmt = PRICE;
      if (i === 2 && j === 2) c.font = { bold: true };
    });
  });
  return wb;
}

export function finWorkbookName(m: EquityInputs): string {
  return `Valora_${m.company.ticker.replace(/[^A-Za-z0-9-]/g, "") || "model"}_excess_return_${m.company.baseYearLabel}.xlsx`;
}
