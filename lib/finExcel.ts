// Builds the excess return model as an Excel workbook with live formulas.
// Blue cells are inputs, black cells are formulas, same as the other exports.

import type ExcelJSType from "exceljs";
import { borders, C, F, FONT, sheet, titleBlock } from "./xlsxStyle";
import { forecastLabels, type EquityInputs } from "./equity";

type ExcelJS = typeof ExcelJSType;

const MONEY = F.num;
const PCT = F.pct2;
const PRICE = F.price;

/** Cell addresses of the key outputs, so tests can read them back. */
export const FIN_CELLS = { costOfEquity: "C14", sumPv: "C28", tvPv: "C31", equity: "C32", perShare: "C33", impliedPb: "C35" };

export function buildFinWorkbook(ExcelJS: ExcelJS, m: EquityInputs) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Valora";
  wb.calcProperties.fullCalcOnLoad = true;
  const cols = ["D", "E", "F", "G", "H"];
  const w = sheet(wb, "Excess return", { labelWidth: 46, dataCols: 6, dataWidth: 12, notesWidth: 70 });
  const ws = w.ws;
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 0 }];

  const label = (r: number, t: string, bold = false) => w.label(r, t, bold ? { bold: true } : { indent: 1 });
  const input = (a: string, v: number, fmt: string) => w.input(a, v, fmt);
  const formula = (a: string, f: string, fmt: string, bold = false) => w.calc(a, f, fmt, { bold });
  const note = (r: number, t?: string) => w.note(r, t);
  const section = (r: number, t: string) => w.section(r, t);

  titleBlock(w, `${m.company.name} (${m.company.ticker})`, "Excess return model", `($ in millions, except per share data). Base year ${m.company.baseYearLabel}.`, true);

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
  cols.forEach((c, i) => w.input(`${c}17`, i + 1, F.int).font = { name: "Arial", size: 10, color: C.gray });
  w.heads(15, cols, labels.map((l) => `${l}E`));
  w.label(15, "Five-year forecast", { bold: true });
  ws.getCell("B15").border = { bottom: borders.thin };
  ws.getCell("C15").border = { bottom: borders.thin };

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
  label(37, "Upside to market price"); formula("C37", "C33/C7-1", F.pct);
  w.total(32, ["C"]);
  w.final(33, ["C"]);

  // History from the filing
  section(39, "Reported history");
  m.history.forEach((h, i) => {
    const col = cols[i] ?? cols.at(-1)!;
    w.heads(39, [col], [`${h.label}A`], { rule: false });
    input(`${col}40`, h.netIncome, MONEY);
    input(`${col}41`, h.bookEquity, MONEY);
    input(`${col}42`, h.payouts, MONEY);
    formula(`${col}43`, i > 0 ? `${col}40/AVERAGE(${cols[i - 1]}41,${col}41)` : `${col}40/${col}41`, PCT);
  });
  label(40, "Net income to common shareholders");
  label(41, "Common book equity, year end");
  label(42, "Dividends plus buybacks");
  label(43, "Return on equity");

  // Sensitivity. Each cell reruns the model at a different cost of equity and long-run ROE.
  // The book equity path doesn't depend on either, so it is read straight from the first sheet.
  const sw = sheet(wb, "Sensitivity", { labelWidth: 30, dataCols: 6, dataWidth: 12 });
  const ss = sw.ws;
  titleBlock(sw, `${m.company.name} (${m.company.ticker})`, "Value per share by long-run ROE and cost of equity", "Live formulas linked to the Excess return sheet. The boxed cell matches that sheet.", true);
  const X = (a: string) => `'Excess return'!${a}`;
  const dR = [-0.02, -0.01, 0, 0.01, 0.02];
  const dK = [-0.01, -0.005, 0, 0.005, 0.01];
  const gc = ["C", "D", "E", "F", "G"];
  const stepFont = { name: FONT, size: 8, color: C.input };
  sw.text("B3", "Step from the model", { italic: true, gray: true, size: 8 });
  sw.text("H4", "Step", { italic: true, gray: true, size: 8, align: "right" });
  sw.text("B4", "Long-run ROE (down), cost of equity (across)", { bold: true, size: 9 });
  dK.forEach((d, j) => {
    sw.input(`${gc[j]}3`, d, F.pctStep).font = stepFont;
    sw.calc(`${gc[j]}4`, `${X("$C$14")}+${gc[j]}$3`, F.pct, { bold: true });
    ss.getCell(`${gc[j]}4`).border = { bottom: borders.thin };
  });
  const book = X("$D$18:$H$18");
  const income = X("$D$20:$H$20");
  const years = X("$D$17:$H$17");
  dR.forEach((d, i) => {
    const r = 5 + i;
    sw.input(`H${r}`, d, F.pctStep).font = stepFont;
    sw.calc(`B${r}`, `${X("$C$12")}+$H${r}`, F.pct, { bold: true });
    ss.getCell(`B${r}`).border = { right: borders.thin };
    gc.forEach((c, j) => {
      const ke = `${c}$4`;
      const roe = `$B${r}`;
      const pvExcess = `SUMPRODUCT(${income}-${ke}*${book},1/(1+${ke})^${years})`;
      const tvPv = `(${roe}-${ke})*${X("$H$22")}/(${ke}-${X("$C$13")})/(1+${ke})^5`;
      sw.calc(`${c}${r}`, `IF(OR(${ke}<=${X("$C$13")},${ke}<=0),"n/a",(${X("$C$5")}+${pvExcess}+${tvPv})/${X("$C$6")})`, F.price, { bold: i === 2 && j === 2 });
    });
  });
  ss.getCell("E7").border = { top: borders.thin, bottom: borders.thin, left: borders.thin, right: borders.thin };
  sw.text("B11", "The small blue steps are inputs: change one to widen or narrow the grid.", { italic: true, gray: true, size: 8 });
  return wb;
}

export function finWorkbookName(m: EquityInputs): string {
  return `Valora_${m.company.ticker.replace(/[^A-Za-z0-9-]/g, "") || "model"}_excess_return_${m.company.baseYearLabel}.xlsx`;
}
