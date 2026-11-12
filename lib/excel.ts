// Builds the model as an Excel workbook with live formulas.
// Inputs are blue (banking convention), formulas are black. Works in the
// browser and in Node; the caller passes in the ExcelJS module.

import type ExcelJSType from "exceljs";
import { baseYear, projectionLabels, runDcf, sensitivity } from "./dcf";
import type { DcfInputs } from "./types";

type ExcelJS = typeof ExcelJSType;

const BLUE = { argb: "FF1F4FBF" };
const INK = { argb: "FF18201C" };
const GRAY = { argb: "FF6B7570" };
const SHADE = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE3E8DB" } };
const MONEY = '#,##0;(#,##0)';
const PCT = "0.0%";
const PCT2 = "0.00%";
const PRICE = '$#,##0.00;($#,##0.00)';

/** Cell addresses of the key outputs, so tests can read them back. */
export const OUTPUT_CELLS = { wacc: "C42", ev: "C52", equity: "C55", price: "C57" };

export function buildWorkbook(ExcelJS: ExcelJS, inputs: DcfInputs) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Valora";
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("DCF", { views: [{ showGridLines: false }] });
  const h = inputs.history;
  const nh = h.length;
  const labels = projectionLabels(inputs.company.baseYearLabel);
  const col = (i: number) => String.fromCharCode(67 + i); // C, D, E...
  const histCols = h.map((_, i) => col(i));
  const projCols = labels.map((_, i) => col(nh + i));
  const lastProj = projCols[4];

  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 52;
  for (let i = 0; i < nh + 5; i++) ws.getColumn(3 + i).width = 13;
  ws.getColumn(3 + nh + 5).width = 60;

  const name = inputs.company.name || "Company";
  ws.getCell("B1").value = `${name}${inputs.company.ticker ? ` (${inputs.company.ticker})` : ""}: discounted cash flow`;
  ws.getCell("B1").font = { bold: true, size: 14, color: INK };
  ws.getCell("B2").value = `Base year ${inputs.company.baseYearLabel}. $ in millions except per share. Blue cells are inputs you can change; black cells are formulas. Built with Valora.`;
  ws.getCell("B2").font = { italic: true, color: GRAY };

  const label = (r: number, text: string, bold = false) => {
    const c = ws.getCell(`B${r}`);
    c.value = text;
    c.font = { bold, color: INK };
  };
  const input = (addr: string, v: number, fmt: string) => {
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
  const section = (r: number, text: string) => {
    label(r, text, true);
    ws.getRow(r).getCell(2).border = { bottom: { style: "thin", color: INK } };
  };
  const note = (r: number, text?: string) => {
    if (!text) return;
    const c = ws.getRow(r).getCell(3 + nh + 5);
    c.value = text;
    c.font = { italic: true, color: GRAY, size: 9 };
  };
  const src = (id: string) => inputs.sources[id]?.note;

  // ---- Assumptions (rows 4-21) ----
  section(4, "Assumptions");
  const A: Record<string, string> = {};
  const rows: [string, string, number, string][] = [
    ["tax", "Tax rate", inputs.taxRate, PCT],
    ["da", "D&A, % of revenue", inputs.daPct, PCT],
    ["capex", "Capex, % of revenue", inputs.capexPct, PCT],
    ["nwc", "Working capital, % of revenue", inputs.nwcPct, PCT],
    ["baseNwc", "Base year working capital", inputs.baseNwc, MONEY],
    ["price", "Share price", inputs.sharePrice, PRICE],
    ["shares", "Shares outstanding (millions)", inputs.sharesOutstanding, "#,##0.0"],
    ["cash", "Cash and investments", inputs.cash, MONEY],
    ["debt", "Total debt", inputs.debt, MONEY],
    ["rf", "Risk-free rate", inputs.riskFreeRate, PCT2],
    ["beta", "Beta", inputs.beta, "0.00"],
    ["erp", "Equity risk premium", inputs.equityRiskPremium, PCT2],
    ["kd", "Pre-tax cost of debt", inputs.preTaxCostOfDebt, PCT2],
    ["g", "Terminal growth rate", inputs.terminalGrowth, PCT],
    ["mult", "Exit multiple (EV / EBITDA)", inputs.exitMultiple, '0.0"x"'],
    ["method", "Terminal method (1 = perpetuity growth, 0 = exit multiple)", inputs.terminalMethod === "gordon" ? 1 : 0, "0"],
    ["mid", "Mid-year convention (1 = on, 0 = off)", inputs.midYear ? 1 : 0, "0"],
  ];
  const srcIds: Record<string, string> = {
    tax: "taxRate", da: "daPct", capex: "capexPct", nwc: "nwcPct", baseNwc: "baseNwc", price: "sharePrice",
    shares: "sharesOutstanding", cash: "cash", debt: "debt", rf: "riskFreeRate", beta: "beta", erp: "equityRiskPremium",
    kd: "preTaxCostOfDebt", g: "terminalGrowth", mult: "exitMultiple",
  };
  rows.forEach(([key, text, v, fmt], i) => {
    const r = 5 + i;
    label(r, text);
    input(`C${r}`, v, fmt);
    A[key] = `$C$${r}`;
    note(r, src(srcIds[key]));
  });

  // ---- Projections (rows 23-38) ----
  const H = 23;
  section(H, "Free cash flow");
  ws.getCell(`B${H}`).value = "Free cash flow";
  [...h.map((y) => y.label), ...labels].forEach((l, i) => {
    const c = ws.getCell(`${col(i)}${H}`);
    c.value = l;
    c.font = { bold: true, color: INK };
    c.alignment = { horizontal: "right" };
    if (i < nh) c.fill = SHADE;
  });
  const R = {
    growth: 24, rev: 25, margin: 26, ebit: 27, taxes: 28, nopat: 29, da: 30, capex: 31,
    nwc: 32, dnwc: 33, ufcf: 34, ebitda: 35, period: 37, df: 38, pv: 39,
  };
  const rowLabels: [keyof typeof R, string, boolean?][] = [
    ["growth", "  Revenue growth"], ["rev", "Revenue"], ["margin", "  Operating margin"], ["ebit", "Operating income (EBIT)"],
    ["taxes", "Less: taxes"], ["nopat", "NOPAT", true], ["da", "Plus: D&A"], ["capex", "Less: capex"],
    ["nwc", "  Working capital"], ["dnwc", "Less: increase in working capital"], ["ufcf", "Unlevered free cash flow", true],
    ["ebitda", "  EBITDA"], ["period", "  Discount period"], ["df", "  Discount factor"], ["pv", "Present value of FCF", true],
  ];
  rowLabels.forEach(([k, t, b]) => label(R[k], t, b));

  // History (values, shaded)
  h.forEach((y, i) => {
    const c = histCols[i];
    const put = (r: number, v: number | { formula: string }, fmt: string) => {
      const cell = ws.getCell(`${c}${r}`);
      cell.value = v;
      cell.numFmt = fmt;
      cell.fill = SHADE;
      cell.font = { color: typeof v === "number" ? BLUE : INK };
    };
    if (i > 0) put(R.growth, { formula: `${c}${R.rev}/${histCols[i - 1]}${R.rev}-1` }, PCT);
    put(R.rev, y.revenue, MONEY);
    put(R.margin, { formula: `${c}${R.ebit}/${c}${R.rev}` }, PCT);
    put(R.ebit, y.ebit, MONEY);
    put(R.da, y.da, MONEY);
    put(R.capex, -y.capex, MONEY);
  });

  // Projections (formulas, with growth and margin as blue inputs)
  projCols.forEach((c, i) => {
    const prev = i === 0 ? histCols[nh - 1] : projCols[i - 1];
    input(`${c}${R.growth}`, inputs.revenueGrowth[i], PCT);
    formula(`${c}${R.rev}`, `${prev}${R.rev}*(1+${c}${R.growth})`, MONEY);
    input(`${c}${R.margin}`, inputs.ebitMargin[i], PCT);
    formula(`${c}${R.ebit}`, `${c}${R.rev}*${c}${R.margin}`, MONEY);
    formula(`${c}${R.taxes}`, `-${c}${R.ebit}*${A.tax}`, MONEY);
    formula(`${c}${R.nopat}`, `${c}${R.ebit}+${c}${R.taxes}`, MONEY, true);
    formula(`${c}${R.da}`, `${c}${R.rev}*${A.da}`, MONEY);
    formula(`${c}${R.capex}`, `-${c}${R.rev}*${A.capex}`, MONEY);
    formula(`${c}${R.nwc}`, `${c}${R.rev}*${A.nwc}`, MONEY);
    const prevNwc = i === 0 ? A.baseNwc : `${projCols[i - 1]}${R.nwc}`;
    formula(`${c}${R.dnwc}`, `-(${c}${R.nwc}-${prevNwc})`, MONEY);
    formula(`${c}${R.ufcf}`, `${c}${R.nopat}+${c}${R.da}+${c}${R.capex}+${c}${R.dnwc}`, MONEY, true);
    formula(`${c}${R.ebitda}`, `${c}${R.ebit}+${c}${R.da}`, MONEY);
    formula(`${c}${R.period}`, `${i + 1}-0.5*${A.mid}`, "0.0");
    formula(`${c}${R.df}`, `1/(1+${OUTPUT_CELLS.wacc.replace("C", "$C$")})^${c}${R.period}`, "0.0000");
    formula(`${c}${R.pv}`, `${c}${R.ufcf}*${c}${R.df}`, MONEY, true);
  });
  ws.getRow(R.ufcf).eachCell((cell, n) => {
    if (n >= 2) cell.border = { top: { style: "thin", color: INK } };
  });

  // ---- Discount rate (rows 41-46 area) ----
  section(41, "Discount rate (WACC)");
  label(42, "WACC");
  label(43, "Cost of equity = risk-free + beta × ERP");
  label(44, "After-tax cost of debt");
  label(45, "Equity weight = market cap / (market cap + debt)");
  label(46, "Market cap");
  formula("C46", `${A.price}*${A.shares}`, MONEY);
  formula("C43", `${A.rf}+${A.beta}*${A.erp}`, PCT2);
  formula("C44", `${A.kd}*(1-${A.tax})`, PCT2);
  formula("C45", `IF(C46+${A.debt}=0,1,C46/(C46+${A.debt}))`, PCT);
  formula("C42", `C45*C43+(1-C45)*C44`, PCT2, true);

  // ---- Valuation (rows 48-58) ----
  section(48, "Valuation");
  label(49, "Terminal value at end of year 5");
  formula("C49", `IF(${A.method}=1,${lastProj}${R.ufcf}*(1+${A.g})/($C$42-${A.g}),${lastProj}${R.ebitda}*${A.mult})`, MONEY);
  label(50, "PV of terminal value");
  formula("C50", `C49/(1+$C$42)^5`, MONEY);
  label(51, "PV of five years of free cash flow");
  formula("C51", `SUM(${projCols[0]}${R.pv}:${lastProj}${R.pv})`, MONEY);
  label(52, "Enterprise value", true);
  formula("C52", "C50+C51", MONEY, true);
  label(53, "Less: debt");
  formula("C53", `-${A.debt}`, MONEY);
  label(54, "Plus: cash and investments");
  formula("C54", `${A.cash}`, MONEY);
  label(55, "Equity value", true);
  formula("C55", "C52+C53+C54", MONEY, true);
  label(56, "Divided by shares (millions)");
  formula("C56", `${A.shares}`, "#,##0.0");
  label(57, "Implied value per share", true);
  formula("C57", "C55/C56", PRICE, true);
  label(58, "Upside vs. share price");
  formula("C58", `IF(${A.price}=0,"",C57/${A.price}-1)`, PCT);
  ws.getCell("C57").border = { top: { style: "thin", color: INK }, bottom: { style: "double", color: INK } };
  label(59, "Terminal value as % of enterprise value");
  formula("C59", "C50/C52", PCT);

  // ---- Sensitivity (values; Excel can't recalc this without data tables) ----
  const sw = wb.addWorksheet("Sensitivity", { views: [{ showGridLines: false }] });
  sw.getColumn(1).width = 2;
  sw.getColumn(2).width = 16;
  for (let i = 3; i <= 8; i++) sw.getColumn(i).width = 13;
  const gordon = inputs.terminalMethod === "gordon";
  const s = sensitivity(inputs, [-0.01, -0.005, 0, 0.005, 0.01], gordon ? [-0.01, -0.005, 0, 0.005, 0.01] : [-4, -2, 0, 2, 4]);
  sw.getCell("B1").value = "Implied value per share";
  sw.getCell("B1").font = { bold: true, size: 13 };
  sw.getCell("B2").value = `Rows: WACC. Columns: ${gordon ? "terminal growth" : "exit multiple"}. These are values from Valora at export time; they won't update if you change the DCF sheet.`;
  sw.getCell("B2").font = { italic: true, color: GRAY };
  s.terminals.forEach((t, j) => {
    const c = sw.getCell(4, 3 + j);
    c.value = t;
    c.numFmt = gordon ? PCT : '0.0"x"';
    c.font = { bold: true };
  });
  s.waccs.forEach((w, i) => {
    const c = sw.getCell(5 + i, 2);
    c.value = w;
    c.numFmt = PCT2;
    c.font = { bold: true };
    s.prices[i].forEach((p, j) => {
      const cell = sw.getCell(5 + i, 3 + j);
      cell.value = Number.isFinite(p) ? p : "n/a";
      cell.numFmt = PRICE;
      if (i === 2 && j === 2) cell.font = { bold: true };
    });
  });

  return wb;
}

/** File name like "Valora_AAPL_FY2026.xlsx" */
export function workbookName(inputs: DcfInputs): string {
  const id = (inputs.company.ticker || inputs.company.name || "model").replace(/[^A-Za-z0-9-]/g, "");
  return `Valora_${id || "model"}_${inputs.company.baseYearLabel}.xlsx`;
}

export { runDcf, baseYear };
