// Builds the options model as an Excel workbook with live formulas.
// Inputs are blue, formulas black, same as the DCF export. Every number,
// from d1 to the Greeks and the sensitivity grid, recalculates in Excel.

import type ExcelJSType from "exceljs";
import type { OptionModel } from "./optionModel";

type ExcelJS = typeof ExcelJSType;

const BLUE = { argb: "FF1F4FBF" };
const INK = { argb: "FF18201C" };
const GRAY = { argb: "FF6B7570" };
const SHADE = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE3E8DB" } };
const PRICE = '$#,##0.00;($#,##0.00)';
const PCT = "0.00%";
const NUM4 = "0.0000";
const DATE = "mmm d, yyyy";

/** Cell addresses of the key outputs, so tests can read them back. */
export const OPTION_CELLS = {
  call: "C27",
  put: "D27",
  d1: "C18",
  d2: "C19",
  callDelta: "C36",
  putDelta: "D36",
  gamma: "C37",
  vega: "C38",
  callTheta: "C39",
  putTheta: "D39",
  callRho: "C40",
  putRho: "D40",
  parity: "C33",
};

const SHEET = "'Black-Scholes'";
const ref = (c: string) => `${SHEET}!$${c.replace(/(\d+)/, "$$$1")}`;

/** Black-Scholes price as one formula, for the sensitivity grid. */
function bsFormula(S: string, sig: string, type: "call" | "put") {
  const K = ref("C6"), T = ref("C15"), r = ref("C16"), q = ref("C11");
  const d1 = `((LN(${S}/${K})+(${r}-${q}+${sig}^2/2)*${T})/(${sig}*SQRT(${T})))`;
  const d2 = `(${d1}-${sig}*SQRT(${T}))`;
  return type === "call"
    ? `${S}*EXP(-${q}*${T})*NORMSDIST(${d1})-${K}*EXP(-${r}*${T})*NORMSDIST(${d2})`
    : `${K}*EXP(-${r}*${T})*NORMSDIST(-${d2})-${S}*EXP(-${q}*${T})*NORMSDIST(-${d1})`;
}

const asDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function buildOptionWorkbook(ExcelJS: ExcelJS, m: OptionModel) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Valora";
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("Black-Scholes", { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 15;
  ws.getColumn(5).width = 80;

  const label = (r: number, text: string, bold = false) => {
    const c = ws.getCell(`B${r}`);
    c.value = text;
    c.font = { bold, color: INK };
  };
  const input = (addr: string, v: number | Date, fmt: string) => {
    const c = ws.getCell(addr);
    c.value = v;
    c.numFmt = fmt;
    c.font = { color: BLUE };
  };
  const formula = (addr: string, f: string, fmt: string, bold = false) => {
    const c = ws.getCell(addr);
    c.value = { formula: f };
    c.numFmt = fmt;
    c.font = { color: INK, bold };
  };
  const note = (r: number, text: string) => {
    const c = ws.getCell(`E${r}`);
    c.value = text;
    c.font = { italic: true, color: GRAY, size: 9 };
  };
  const section = (r: number, text: string, heads?: [string, string]) => {
    label(r, text, true);
    ws.getCell(`B${r}`).border = { bottom: { style: "thin", color: INK } };
    if (heads) {
      for (const [col, h] of [["C", heads[0]], ["D", heads[1]]] as const) {
        const c = ws.getCell(`${col}${r}`);
        c.value = h;
        c.font = { bold: true, color: INK };
        c.alignment = { horizontal: "right" };
        c.border = { bottom: { style: "thin", color: INK } };
      }
    }
  };

  ws.getCell("B1").value = `${m.name} (${m.ticker}): ${m.type === "call" ? "call" : "put"} option, Black-Scholes`;
  ws.getCell("B1").font = { bold: true, size: 14, color: INK };
  ws.getCell("B2").value = "Per share unless noted. Blue cells are inputs you can change; black cells are formulas. Built with Valora.";
  ws.getCell("B2").font = { italic: true, color: GRAY };

  section(4, "Inputs");
  label(5, "Share price (S)"); input("C5", m.S, PRICE); note(5, m.sources.S ?? "");
  label(6, "Strike price (K)"); input("C6", m.K, PRICE);
  label(7, "Valuation date"); input("C7", asDate(m.valuationDate), DATE);
  label(8, "Expiration date"); input("C8", asDate(m.expiry), DATE);
  label(9, "Volatility (σ), per year"); input("C9", m.sigma, PCT); note(9, m.sources.sigma ?? "");
  label(10, "10-year Treasury yield, as quoted"); input("C10", m.treasury, PCT); note(10, m.sources.treasury ?? "");
  label(11, "Dividend yield (q)"); input("C11", m.q, PCT); note(11, m.sources.q ?? "");

  section(13, "Converted for the formula");
  label(14, "Days to expiration"); formula("C14", "MAX(C8-C7,0)", "0");
  label(15, "T, years to expiration"); formula("C15", "MAX(C14,0.5)/365", NUM4);
  note(15, "Days / 365. Half a day minimum keeps the formula defined on expiration day.");
  label(16, "r, risk-free rate (continuous)"); formula("C16", "2*LN(1+C10/2)", "0.000%");
  note(16, "Treasury yields compound twice a year; Black-Scholes uses continuous compounding: 2 × ln(1 + y / 2).");
  label(18, "d1"); formula("C18", "(LN(C5/C6)+(C16-C11+C9^2/2)*C15)/(C9*SQRT(C15))", NUM4);
  note(18, "How far in the money the option is, in standard deviations, after drift.");
  label(19, "d2"); formula("C19", "C18-C9*SQRT(C15)", NUM4);
  note(19, "d1 minus one volatility-adjusted step. N(d2) is the risk-neutral chance the call finishes in the money.");
  label(20, "N(d1)"); formula("C20", "NORMSDIST(C18)", NUM4);
  label(21, "N(d2)"); formula("C21", "NORMSDIST(C19)", NUM4);
  label(22, "N(−d1)"); formula("C22", "NORMSDIST(-C18)", NUM4);
  label(23, "N(−d2)"); formula("C23", "NORMSDIST(-C19)", NUM4);
  label(24, "Normal density at d1, N'(d1)"); formula("C24", "EXP(-((C18)^2)/2)/SQRT(2*PI())", NUM4);
  note(24, "Used by gamma, vega and theta.");

  section(26, "Value", ["Call", "Put"]);
  label(27, "Black-Scholes price", true);
  formula("C27", "C5*EXP(-C11*C15)*C20-C6*EXP(-C16*C15)*C21", PRICE, true);
  formula("D27", "C6*EXP(-C16*C15)*C23-C5*EXP(-C11*C15)*C22", PRICE, true);
  note(27, "Call = S·e^(−qT)·N(d1) − K·e^(−rT)·N(d2). Put = K·e^(−rT)·N(−d2) − S·e^(−qT)·N(−d1).");
  label(28, "Per contract (100 shares)"); formula("C28", "C27*100", PRICE); formula("D28", "D27*100", PRICE);
  label(29, "Intrinsic value"); formula("C29", "MAX(C5-C6,0)", PRICE); formula("D29", "MAX(C6-C5,0)", PRICE);
  note(29, "What the option would be worth if exercised today.");
  label(30, "Time value"); formula("C30", "C27-C29", PRICE); formula("D30", "D27-D29", PRICE);
  label(31, "Breakeven at expiration"); formula("C31", "C6+C27", PRICE); formula("D31", "C6-D27", PRICE);
  label(32, "Chance it finishes in the money"); formula("C32", "C21", "0.0%"); formula("D32", "C23", "0.0%");
  note(32, "Risk-neutral probability, not a forecast.");
  label(33, "Put-call parity check (should be 0)"); formula("C33", "(C27-D27)-(C5*EXP(-C11*C15)-C6*EXP(-C16*C15))", "0.000000");
  note(33, "Call − put must equal S·e^(−qT) − K·e^(−rT). Any other result means a formula is wrong.");

  section(35, "The Greeks", ["Call", "Put"]);
  label(36, "Delta"); formula("C36", "EXP(-C11*C15)*C20", NUM4); formula("D36", "-EXP(-C11*C15)*C22", NUM4);
  note(36, "Change in option price for a $1 rise in the stock.");
  label(37, "Gamma"); formula("C37", "EXP(-C11*C15)*C24/(C5*C9*SQRT(C15))", NUM4); formula("D37", "C37", NUM4);
  note(37, "Change in delta for a $1 rise in the stock. Same for the call and the put.");
  label(38, "Vega, per 1 point of volatility"); formula("C38", "C5*EXP(-C11*C15)*C24*SQRT(C15)/100", NUM4); formula("D38", "C38", NUM4);
  note(38, "Change in price if volatility rises one point, say 25% to 26%.");
  label(39, "Theta, per calendar day");
  formula("C39", "(-(C5*EXP(-C11*C15)*C24*C9)/(2*SQRT(C15))-C16*C6*EXP(-C16*C15)*C21+C11*C5*EXP(-C11*C15)*C20)/365", NUM4);
  formula("D39", "(-(C5*EXP(-C11*C15)*C24*C9)/(2*SQRT(C15))+C16*C6*EXP(-C16*C15)*C23-C11*C5*EXP(-C11*C15)*C22)/365", NUM4);
  note(39, "Change in price as one day passes, all else equal. Usually negative: options lose value with time.");
  label(40, "Rho, per 1 point of interest rates");
  formula("C40", "C6*C15*EXP(-C16*C15)*C21/100", NUM4);
  formula("D40", "-C6*C15*EXP(-C16*C15)*C23/100", NUM4);
  note(40, "Change in price if the risk-free rate rises one point.");

  label(42, "Implied volatility", true);
  ws.getCell("B43").value =
    "To find the volatility a market price implies, use Data > What-If Analysis > Goal Seek: set C27 (or D27 for a put) to the market price by changing C9.";
  ws.getCell("B43").font = { italic: true, color: GRAY };
  for (const r of [27]) for (const c of ["B", "C", "D"]) ws.getCell(`${c}${r}`).fill = SHADE;

  // Sensitivity: the focused option's value across share prices and volatilities, all live.
  const ss = wb.addWorksheet("Sensitivity", { views: [{ showGridLines: false }] });
  ss.getColumn(1).width = 2;
  ss.getColumn(2).width = 16;
  for (let i = 0; i < 5; i++) ss.getColumn(3 + i).width = 13;
  ss.getCell("B1").value = `${m.type === "call" ? "Call" : "Put"} value by share price (across) and volatility (down)`;
  ss.getCell("B1").font = { bold: true, size: 13, color: INK };
  ss.getCell("B2").value = "Linked to the Black-Scholes sheet. Change an input there and this grid updates.";
  ss.getCell("B2").font = { italic: true, color: GRAY };
  const steps = [-0.1, -0.05, 0, 0.05, 0.1];
  const cols = ["C", "D", "E", "F", "G"];
  steps.forEach((d, i) => {
    const c = ss.getCell(`${cols[i]}4`);
    c.value = { formula: `${ref("C5")}*(1+${d})` };
    c.numFmt = PRICE;
    c.font = { bold: true, color: INK };
    c.fill = SHADE;
  });
  steps.forEach((dv, j) => {
    const row = 5 + j;
    const h = ss.getCell(`B${row}`);
    h.value = { formula: `MAX(0.01,${ref("C9")}+${dv})` };
    h.numFmt = "0%";
    h.font = { bold: true, color: INK };
    h.fill = SHADE;
    cols.forEach((col) => {
      const c = ss.getCell(`${col}${row}`);
      c.value = { formula: bsFormula(`${col}$4`, `$B${row}`, m.type) };
      c.numFmt = PRICE;
      c.font = { color: INK, bold: j === 2 && col === "E" };
      if (j === 2 && col === "E") c.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "medium" } };
    });
  });

  return wb;
}

export function optionWorkbookName(m: OptionModel): string {
  const strike = Number.isInteger(m.K) ? String(m.K) : m.K.toFixed(2);
  return `Valora_${m.ticker.replace(/[^A-Za-z0-9-]/g, "")}_${strike}${m.type === "call" ? "C" : "P"}_${m.expiry}.xlsx`;
}
