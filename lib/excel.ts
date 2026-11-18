// Builds the model as an Excel workbook with live formulas.
// Inputs are blue (banking convention), formulas are black. Works in the
// browser and in Node; the caller passes in the ExcelJS module.

import type ExcelJSType from "exceljs";
import { baseYear, projectionLabels, runDcf } from "./dcf";
import { caseValues, getScenarios, SCENARIO_IDS, SCENARIO_LABEL, type ScenarioId } from "./scenarios";
import type { DcfInputs } from "./types";

type ExcelJS = typeof ExcelJSType;

const BLUE = { argb: "FF1F4FBF" };
const INK = { argb: "FF18201C" };
const GRAY = { argb: "FF6B7570" };
const MONEY = '#,##0;(#,##0)';
const PCT = "0.0%";
const PCT2 = "0.00%";
const PRICE = '$#,##0.00;($#,##0.00)';

/** Cell addresses of the key outputs, so tests can read them back. */
export const OUTPUT_CELLS = { wacc: "C42", ev: "C52", equity: "C55", price: "C57" };

export function buildWorkbook(ExcelJS: ExcelJS, inputs: DcfInputs, active: ScenarioId = "base") {
  const sc = getScenarios(inputs);
  const caseVals: Record<ScenarioId, ReturnType<typeof caseValues>> = {
    bear: caseValues(inputs, "bear"),
    base: caseValues(inputs, "base"),
    bull: caseValues(inputs, "bull"),
  };
  const wb = new ExcelJS.Workbook();
  wb.creator = "Valora";
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("DCF");
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

  // ---- Bull, base and bear inputs (rows 61-74). Row 62 picks the case. ----
  const SW = 62;
  const CR = { g: [64, 65, 66], m: [67, 68, 69], capex: 72, tg: 73, mult: 74 };
  section(61, "Bull, base and bear cases");
  label(SW, "Case shown on this sheet (1 = bear, 2 = base, 3 = bull)", true);
  input(`C${SW}`, SCENARIO_IDS.indexOf(active) + 1, "0");
  ws.getCell(`C${SW}`).border = { top: { style: "thin", color: INK }, bottom: { style: "thin", color: INK }, left: { style: "thin", color: INK }, right: { style: "thin", color: INK } };
  note(SW, "Change this to 1, 2 or 3 and the whole model recalculates for that case.");
  SCENARIO_IDS.forEach((id, k) => {
    label(CR.g[k], `Revenue growth, ${SCENARIO_LABEL[id].toLowerCase()}`);
    label(CR.m[k], `Operating margin, ${SCENARIO_LABEL[id].toLowerCase()}`);
    for (let i = 0; i < 5; i++) {
      const c = col(nh + i);
      input(`${c}${CR.g[k]}`, caseVals[id].revenueGrowth[i], PCT);
      input(`${c}${CR.m[k]}`, caseVals[id].ebitMargin[i], PCT);
    }
    const hc = ws.getCell(`${col(k)}71`);
    hc.value = SCENARIO_LABEL[id];
    hc.font = { bold: true, color: INK };
    hc.alignment = { horizontal: "right" };
    input(`${col(k)}${CR.capex}`, caseVals[id].capexPct, PCT);
    input(`${col(k)}${CR.tg}`, caseVals[id].terminalGrowth, PCT);
    input(`${col(k)}${CR.mult}`, caseVals[id].exitMultiple, '0.0"x"');
  });
  label(CR.capex, "Capex, % of revenue");
  label(CR.tg, "Terminal growth rate");
  label(CR.mult, "Exit multiple (EV / EBITDA)");
  const pickRow = (r: number) => `CHOOSE($C$${SW},$C$${r},$D$${r},$E$${r})`;
  formula(A.capex.replace(/\$/g, ""), pickRow(CR.capex), PCT);
  formula(A.g.replace(/\$/g, ""), pickRow(CR.tg), PCT);
  formula(A.mult.replace(/\$/g, ""), pickRow(CR.mult), '0.0"x"');
  note(Number(A.capex.split("$").pop()), "Picked from the case table below.");
  note(Number(A.g.split("$").pop()), "Picked from the case table below.");
  note(Number(A.mult.split("$").pop()), "Picked from the case table below.");

  // ---- Projections (rows 23-38) ----
  const H = 23;
  section(H, "Free cash flow");
  ws.getCell(`B${H}`).value = "Free cash flow";
  [...h.map((y) => y.label), ...labels].forEach((l, i) => {
    const c = ws.getCell(`${col(i)}${H}`);
    c.value = l;
    c.font = { bold: true, color: INK };
    c.alignment = { horizontal: "right" };
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
    formula(`${c}${R.growth}`, `CHOOSE($C$${SW},${c}${CR.g[0]},${c}${CR.g[1]},${c}${CR.g[2]})`, PCT);
    formula(`${c}${R.rev}`, `${prev}${R.rev}*(1+${c}${R.growth})`, MONEY);
    formula(`${c}${R.margin}`, `CHOOSE($C$${SW},${c}${CR.m[0]},${c}${CR.m[1]},${c}${CR.m[2]})`, PCT);
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

  // ---- Sensitivity. Every cell reprices the DCF sheet's own cash flows at a different WACC and
  // terminal input, so the grids follow whatever case and inputs the DCF sheet shows. ----
  const D = (addr: string) => `DCF!${addr.includes("$") ? addr : addr.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2")}`;
  const fcfRange = `DCF!$${projCols[0]}$${R.ufcf}:$${lastProj}$${R.ufcf}`;
  const periodRange = `DCF!$${projCols[0]}$${R.period}:$${lastProj}$${R.period}`;
  const toEquity = (ev: string) => `((${ev})-${D(A.debt)}+${D(A.cash)})/${D(A.shares)}`;
  const pvFcf = (w: string) => `SUMPRODUCT(${fcfRange},1/(1+${w})^${periodRange})`;

  const sw = wb.addWorksheet("Sensitivity");
  sw.getColumn(1).width = 2;
  sw.getColumn(2).width = 18;
  for (let i = 3; i <= 8; i++) sw.getColumn(i).width = 13;
  sw.getCell("B1").value = "Implied value per share";
  sw.getCell("B1").font = { bold: true, size: 13 };
  sw.getCell("B2").value =
    "Live formulas linked to the DCF sheet. Rows change WACC; columns change the terminal input. The middle cell matches the DCF sheet. Edit any blue step to widen or narrow a grid.";
  sw.getCell("B2").font = { italic: true, color: GRAY };

  const waccSteps = [-0.01, -0.005, 0, 0.005, 0.01];
  const grid = (top: number, title: string, termSteps: number[], termBase: string, termFmt: string, stepFmt: string, price: (w: string, t: string) => string) => {
    sw.getCell(`B${top}`).value = title;
    sw.getCell(`B${top}`).font = { bold: true, color: INK };
    sw.getCell(`B${top}`).border = { bottom: { style: "thin", color: INK } };
    // Step inputs (blue) sit beside each axis so the grid can be widened.
    const stepRow = top + 1;
    const headRow = top + 2;
    sw.getCell(`B${stepRow}`).value = "Step from DCF sheet";
    sw.getCell(`B${stepRow}`).font = { italic: true, color: GRAY, size: 9 };
    sw.getCell(`B${headRow}`).value = "WACC (down)";
    sw.getCell(`B${headRow}`).font = { bold: true, color: INK };
    termSteps.forEach((d, j) => {
      const c = String.fromCharCode(67 + j);
      const st = sw.getCell(`${c}${stepRow}`);
      st.value = d;
      st.numFmt = stepFmt;
      st.font = { color: BLUE, size: 9 };
      const hd = sw.getCell(`${c}${headRow}`);
      hd.value = { formula: `${termBase}+${c}$${stepRow}` };
      hd.numFmt = termFmt;
      hd.font = { bold: true, color: INK };
      hd.border = { bottom: { style: "thin", color: INK } };
    });
    sw.getCell(`H${headRow}`).value = "Step";
    sw.getCell(`H${headRow}`).font = { italic: true, color: GRAY, size: 9 };
    waccSteps.forEach((d, i) => {
      const r = headRow + 1 + i;
      const wc = sw.getCell(`B${r}`);
      wc.value = { formula: `DCF!$C$42+$H${r}` };
      wc.numFmt = PCT2;
      wc.font = { bold: true, color: INK };
      const st = sw.getCell(`H${r}`);
      st.value = d;
      st.numFmt = PCT2;
      st.font = { color: BLUE, size: 9 };
      termSteps.forEach((_, j) => {
        const c = String.fromCharCode(67 + j);
        const cell = sw.getCell(`${c}${r}`);
        cell.value = { formula: price(`$B${r}`, `${c}$${headRow}`) };
        cell.numFmt = PRICE;
        cell.font = { color: INK, bold: i === 2 && j === 2 };
      });
    });
  };
  const lastFcf = `DCF!$${lastProj}$${R.ufcf}`;
  const lastEbitda = `DCF!$${lastProj}$${R.ebitda}`;
  grid(4, "Perpetuity growth method: WACC against terminal growth", [-0.01, -0.005, 0, 0.005, 0.01], D(A.g), PCT, PCT, (w, t) =>
    `IF(${w}<=${t},"n/a",${toEquity(`${pvFcf(w)}+${lastFcf}*(1+${t})/(${w}-${t})/(1+${w})^5`)})`,
  );
  grid(14, "Exit multiple method: WACC against exit multiple", [-4, -2, 0, 2, 4], D(A.mult), '0.0"x"', '+0.0"x";-0.0"x";0.0"x"', (w, t) =>
    toEquity(`${pvFcf(w)}+${lastEbitda}*${t}/(1+${w})^5`),
  );
  sw.getCell("B24").value = "The DCF sheet uses the perpetuity growth method when its terminal method cell is 1, and the exit multiple method when it is 0.";
  sw.getCell("B24").font = { italic: true, color: GRAY, size: 9 };

  // ---- Scenarios. Each case is rebuilt in full from its inputs on the DCF sheet, so all three
  // values per share, the weights and the weighted value are live. ----
  const ss = wb.addWorksheet("Scenarios");
  ss.getColumn(1).width = 2;
  ss.getColumn(2).width = 34;
  for (let i = 3; i <= 7; i++) ss.getColumn(i).width = 14;
  ss.getCell("B1").value = "Bull, base and bear";
  ss.getCell("B1").font = { bold: true, size: 13 };
  ss.getCell("B2").value =
    "Live formulas. Each case below is a full five-year DCF built from that case's inputs on the DCF sheet (rows 64 to 74) and its shared assumptions. Change the blue probabilities to reweight.";
  ss.getCell("B2").font = { italic: true, color: GRAY };
  ["Case", "Value per share", "Probability"].forEach((t, k) => {
    const c = ss.getCell(4, 2 + k);
    c.value = t;
    c.font = { bold: true };
    c.border = { bottom: { style: "thin", color: INK } };
  });

  const wacc = "DCF!$C$42";
  const BLOCK = 14; // first case block row
  const SIZE = 15;
  const P = ["C", "D", "E", "F", "G"]; // projection columns on this sheet
  const lastHistRev = `DCF!$${histCols[nh - 1]}$${R.rev}`;
  SCENARIO_IDS.forEach((id, k) => {
    const top = BLOCK + k * SIZE;
    const rr = { rev: top + 1, ebit: top + 2, nopat: top + 3, da: top + 4, capex: top + 5, nwc: top + 6, dnwc: top + 7, ufcf: top + 8, ebitda: top + 9, pv: top + 10, tv: top + 11, ev: top + 12, price: top + 13 };
    const head = ss.getCell(`B${top}`);
    head.value = `${SCENARIO_LABEL[id]} case`;
    head.font = { bold: true, color: INK };
    labels.forEach((l, i) => {
      const c = ss.getCell(`${P[i]}${top}`);
      c.value = l;
      c.font = { bold: true, color: INK };
      c.alignment = { horizontal: "right" };
    });
    for (let i = top; i <= rr.price; i++) ss.getCell(`B${i}`).border = {};
    ss.getRow(top).eachCell((cell) => (cell.border = { bottom: { style: "thin", color: INK } }));
    const L: [number, string, boolean?][] = [
      [rr.rev, "Revenue"], [rr.ebit, "Operating income (EBIT)"], [rr.nopat, "NOPAT"], [rr.da, "Plus: D&A"],
      [rr.capex, "Less: capex"], [rr.nwc, "  Working capital"], [rr.dnwc, "Less: increase in working capital"],
      [rr.ufcf, "Unlevered free cash flow", true], [rr.ebitda, "  EBITDA"], [rr.pv, "Present value of FCF"],
      [rr.tv, "Terminal value at end of year 5"], [rr.ev, "Enterprise value", true], [rr.price, "Implied value per share", true],
    ];
    L.forEach(([r, t, b]) => {
      ss.getCell(`B${r}`).value = t;
      ss.getCell(`B${r}`).font = { bold: !!b, color: INK };
    });
    const f = (addr: string, formulaText: string, fmt: string, bold = false) => {
      const c = ss.getCell(addr);
      c.value = { formula: formulaText };
      c.numFmt = fmt;
      c.font = { color: INK, bold };
    };
    P.forEach((c, i) => {
      const dcfCol = projCols[i];
      const prev = i === 0 ? lastHistRev : `${P[i - 1]}${rr.rev}`;
      f(`${c}${rr.rev}`, `${prev}*(1+DCF!$${dcfCol}$${CR.g[k]})`, MONEY);
      f(`${c}${rr.ebit}`, `${c}${rr.rev}*DCF!$${dcfCol}$${CR.m[k]}`, MONEY);
      f(`${c}${rr.nopat}`, `${c}${rr.ebit}*(1-${D(A.tax)})`, MONEY);
      f(`${c}${rr.da}`, `${c}${rr.rev}*${D(A.da)}`, MONEY);
      f(`${c}${rr.capex}`, `-${c}${rr.rev}*DCF!$${col(k)}$${CR.capex}`, MONEY);
      f(`${c}${rr.nwc}`, `${c}${rr.rev}*${D(A.nwc)}`, MONEY);
      const prevNwc = i === 0 ? D(A.baseNwc) : `${P[i - 1]}${rr.nwc}`;
      f(`${c}${rr.dnwc}`, `-(${c}${rr.nwc}-${prevNwc})`, MONEY);
      f(`${c}${rr.ufcf}`, `${c}${rr.nopat}+${c}${rr.da}+${c}${rr.capex}+${c}${rr.dnwc}`, MONEY, true);
      f(`${c}${rr.ebitda}`, `${c}${rr.ebit}+${c}${rr.da}`, MONEY);
      f(`${c}${rr.pv}`, `${c}${rr.ufcf}/(1+${wacc})^DCF!$${dcfCol}$${R.period}`, MONEY);
    });
    const tg = `DCF!$${col(k)}$${CR.tg}`;
    const mult = `DCF!$${col(k)}$${CR.mult}`;
    f(`C${rr.tv}`, `IF(${D(A.method)}=1,IF(${wacc}<=${tg},NA(),G${rr.ufcf}*(1+${tg})/(${wacc}-${tg})),G${rr.ebitda}*${mult})`, MONEY);
    f(`C${rr.ev}`, `SUM(C${rr.pv}:G${rr.pv})+C${rr.tv}/(1+${wacc})^5`, MONEY, true);
    f(`C${rr.price}`, toEquity(`C${rr.ev}`), PRICE, true);
    ss.getCell(`C${rr.price}`).border = { top: { style: "thin", color: INK }, bottom: { style: "double", color: INK } };

    // Summary row for this case
    const r = 5 + k;
    ss.getCell(r, 2).value = SCENARIO_LABEL[id];
    const v = ss.getCell(r, 3);
    v.value = { formula: `IFERROR(C${rr.price},"n/a")` };
    v.numFmt = PRICE;
    const w = ss.getCell(r, 4);
    w.value = sc.weights[id];
    w.numFmt = "0%";
    w.font = { color: BLUE };
  });
  ss.getCell("B9").value = "Probability-weighted value";
  ss.getCell("B9").font = { bold: true };
  const wv = ss.getCell("C9");
  wv.value = { formula: "SUMPRODUCT(C5:C7,D5:D7)/SUM(D5:D7)" };
  wv.numFmt = PRICE;
  wv.font = { bold: true };
  wv.border = { top: { style: "thin", color: INK }, bottom: { style: "double", color: INK } };
  ss.getCell("B10").value = "Share price";
  ss.getCell("C10").value = { formula: D(A.price) };
  ss.getCell("C10").numFmt = PRICE;
  ss.getCell("B11").value = "Upside to weighted value";
  ss.getCell("C11").value = { formula: 'IF(C10=0,"",C9/C10-1)' };
  ss.getCell("C11").numFmt = PCT;

  return wb;
}

/** File name like "Valora_AAPL_FY2026.xlsx" */
export function workbookName(inputs: DcfInputs): string {
  const id = (inputs.company.ticker || inputs.company.name || "model").replace(/[^A-Za-z0-9-]/g, "");
  return `Valora_${id || "model"}_${inputs.company.baseYearLabel}.xlsx`;
}

export { runDcf, baseYear };
