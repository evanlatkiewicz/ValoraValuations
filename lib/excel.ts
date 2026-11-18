// Builds the DCF as an Excel workbook with live formulas, laid out the way a
// banking model is: summary on top, grouped assumptions, the case table, the
// free cash flow build, WACC and the valuation bridge. Every number that isn't
// a hard-coded input is a formula. Works in the browser and in Node; the caller
// passes in the ExcelJS module.

import type ExcelJSType from "exceljs";
import { baseYear, projectionLabels, runDcf } from "./dcf";
import { caseValues, getScenarios, SCENARIO_IDS, SCENARIO_LABEL, type ScenarioId } from "./scenarios";
import type { DcfInputs } from "./types";
import { borders, C, colL, F, FONT, sheet, titleBlock } from "./xlsxStyle";

type ExcelJS = typeof ExcelJSType;

/** Cell addresses of the key outputs, so tests can read them back. */
export const OUTPUT_CELLS = { wacc: "C87", ev: "C93", equity: "C96", price: "C98" };

// Fixed rows on the DCF sheet, shared with the Sensitivity and Scenarios sheets.
const A = {
  tax: 18, da: 19, capex: 20, nwc: 21, baseNwc: 22,
  price: 25, shares: 26, cash: 27, debt: 28,
  rf: 31, beta: 32, erp: 33, kd: 34,
  g: 37, mult: 38, method: 39, mid: 40,
};
type AKey = keyof typeof A;
const a = (k: AKey) => `$C$${A[k]}`;
const SW = 43;
const CR = { g: [46, 47, 48], m: [50, 51, 52], capex: 55, tg: 56, mult: 57 };
const R = {
  rev: 62, growth: 63, ebit: 64, margin: 65, taxes: 66, nopat: 67, da: 68, capex: 69, dnwc: 70, ufcf: 71,
  ebitda: 73, nwc: 74, period: 76, df: 77, pv: 78,
};
const WACC = "$C$87";

export function buildWorkbook(ExcelJS: ExcelJS, inputs: DcfInputs, active: ScenarioId = "base") {
  const sc = getScenarios(inputs);
  const caseVals = Object.fromEntries(SCENARIO_IDS.map((id) => [id, caseValues(inputs, id)])) as Record<
    ScenarioId,
    ReturnType<typeof caseValues>
  >;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Valora";
  wb.calcProperties.fullCalcOnLoad = true;

  const h = inputs.history;
  const nh = h.length;
  const labels = projectionLabels(inputs.company.baseYearLabel);
  const col = (i: number) => colL(3 + i); // C, D, E...
  const histCols = h.map((_, i) => col(i));
  const projCols = labels.map((_, i) => col(nh + i));
  const allCols = [...histCols, ...projCols];
  const lastProj = projCols[4];
  const lastHist = histCols[nh - 1];

  const w = sheet(wb, "DCF", { labelWidth: 46, dataCols: nh + 5, dataWidth: 12, notesWidth: 62 });
  const ws = w.ws;
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 0 }];
  const name = inputs.company.name || "Company";
  titleBlock(
    w,
    `${name}${inputs.company.ticker ? ` (${inputs.company.ticker})` : ""}`,
    "Discounted cash flow analysis",
    `($ in millions, except per share data). Base year ${inputs.company.baseYearLabel}.`,
  );
  const src = (id: string) => inputs.sources[id]?.note;

  // ---------------- Assumptions ----------------
  w.section(16, "Assumptions");
  w.label(17, "Operating", { italic: true });
  w.label(24, "Market and balance sheet", { italic: true });
  w.label(30, "Discount rate", { italic: true });
  w.label(36, "Terminal value", { italic: true });
  const rows: [AKey, string, number, string, string?][] = [
    ["tax", "Tax rate", inputs.taxRate, F.pct, "taxRate"],
    ["da", "D&A, % of revenue", inputs.daPct, F.pct, "daPct"],
    ["nwc", "Working capital, % of revenue", inputs.nwcPct, F.pct, "nwcPct"],
    ["baseNwc", `Working capital, ${inputs.company.baseYearLabel}`, inputs.baseNwc, F.num, "baseNwc"],
    ["price", "Current share price", inputs.sharePrice, F.price, "sharePrice"],
    ["shares", "Diluted shares outstanding (millions)", inputs.sharesOutstanding, F.num1, "sharesOutstanding"],
    ["cash", "Cash and investments", inputs.cash, F.num, "cash"],
    ["debt", "Total debt", inputs.debt, F.num, "debt"],
    ["rf", "Risk-free rate", inputs.riskFreeRate, F.pct2, "riskFreeRate"],
    ["beta", "Beta", inputs.beta, "0.00_)", "beta"],
    ["erp", "Equity risk premium", inputs.equityRiskPremium, F.pct2, "equityRiskPremium"],
    ["kd", "Pre-tax cost of debt", inputs.preTaxCostOfDebt, F.pct2, "preTaxCostOfDebt"],
    ["method", "Terminal method (1 = perpetuity growth, 0 = exit multiple)", inputs.terminalMethod === "gordon" ? 1 : 0, F.int],
    ["mid", "Mid-year convention (1 = on, 0 = off)", inputs.midYear ? 1 : 0, F.int],
  ];
  for (const [k, text, v, fmt, s] of rows) {
    w.label(A[k], text, { indent: 1 });
    w.input(`C${A[k]}`, v, fmt);
    w.note(A[k], s ? src(s) : undefined);
  }

  // ---------------- Cases ----------------
  w.section(42, "Bull, base and bear cases");
  w.label(SW, "Case shown (1 = bear, 2 = base, 3 = bull)", { bold: true });
  w.input(`C${SW}`, SCENARIO_IDS.indexOf(active) + 1, F.int, { bold: true });
  ws.getCell(`C${SW}`).border = { top: borders.medium, bottom: borders.medium, left: borders.medium, right: borders.medium };
  w.note(SW, "Change this to 1, 2 or 3 and every sheet recalculates for that case.");
  w.heads(44, projCols, labels.map((l) => `${l}E`));
  w.label(45, "Revenue growth", { italic: true });
  w.label(49, "Operating margin", { italic: true });
  w.heads(54, ["C", "D", "E"], SCENARIO_IDS.map((id) => SCENARIO_LABEL[id]));
  SCENARIO_IDS.forEach((id, k) => {
    w.label(CR.g[k], SCENARIO_LABEL[id], { indent: 1 });
    w.label(CR.m[k], SCENARIO_LABEL[id], { indent: 1 });
    projCols.forEach((c, i) => {
      w.input(`${c}${CR.g[k]}`, caseVals[id].revenueGrowth[i], F.pct);
      w.input(`${c}${CR.m[k]}`, caseVals[id].ebitMargin[i], F.pct);
    });
    w.input(`${col(k)}${CR.capex}`, caseVals[id].capexPct, F.pct);
    w.input(`${col(k)}${CR.tg}`, caseVals[id].terminalGrowth, F.pct);
    w.input(`${col(k)}${CR.mult}`, caseVals[id].exitMultiple, F.mult);
  });
  w.label(CR.capex, "Capex, % of revenue", { indent: 1 });
  w.label(CR.tg, "Terminal growth rate", { indent: 1 });
  w.label(CR.mult, "Exit multiple (EV / EBITDA)", { indent: 1 });

  const pick = (r: number) => `CHOOSE($C$${SW},$C$${r},$D$${r},$E$${r})`;
  for (const [k, text, r, fmt] of [
    ["capex", "Capex, % of revenue", CR.capex, F.pct],
    ["g", "Terminal growth rate", CR.tg, F.pct],
    ["mult", "Exit multiple (EV / EBITDA)", CR.mult, F.mult],
  ] as [AKey, string, number, string][]) {
    w.label(A[k], text, { indent: 1 });
    w.calc(`C${A[k]}`, pick(r), fmt);
    w.note(A[k], "Picked from the case table below by the case cell.");
  }

  // ---------------- Free cash flow ----------------
  w.section(59, "Unlevered free cash flow");
  const band = (cols: string[], text: string) => {
    if (cols.length > 1) ws.mergeCells(`${cols[0]}60:${cols.at(-1)}60`);
    w.text(`${cols[0]}60`, text, { bold: true, align: "center" });
    for (const c of cols) ws.getCell(`${c}60`).border = { bottom: borders.thin };
  };
  band(histCols, "Actual");
  band(projCols, "Projected");
  w.heads(61, allCols, [...h.map((y) => `${y.label}A`), ...labels.map((l) => `${l}E`)]);

  const L: [keyof typeof R, string, { bold?: boolean; indent?: number; italic?: boolean }?][] = [
    ["rev", "Revenue", { bold: true }],
    ["growth", "% growth", { italic: true, indent: 1 }],
    ["ebit", "Operating income (EBIT)"],
    ["margin", "% margin", { italic: true, indent: 1 }],
    ["taxes", "Less: taxes"],
    ["nopat", "NOPAT", { bold: true }],
    ["da", "Plus: depreciation and amortization"],
    ["capex", "Less: capital expenditures"],
    ["dnwc", "Less: increase in working capital"],
    ["ufcf", "Unlevered free cash flow", { bold: true }],
    ["ebitda", "Memo: EBITDA", { italic: true }],
    ["nwc", "Memo: working capital", { italic: true }],
    ["period", "Discount period (years)"],
    ["df", "Discount factor"],
    ["pv", "Present value of free cash flow", { bold: true }],
  ];
  for (const [k, t, o] of L) w.label(R[k], t, o);

  h.forEach((y, i) => {
    const c = histCols[i];
    w.input(`${c}${R.rev}`, y.revenue, F.num, { bold: true });
    if (i > 0) w.calc(`${c}${R.growth}`, `${c}${R.rev}/${histCols[i - 1]}${R.rev}-1`, F.pct, { italic: true });
    w.input(`${c}${R.ebit}`, y.ebit, F.num);
    w.calc(`${c}${R.margin}`, `${c}${R.ebit}/${c}${R.rev}`, F.pct, { italic: true });
    w.input(`${c}${R.da}`, y.da, F.num);
    w.input(`${c}${R.capex}`, -y.capex, F.num);
    w.calc(`${c}${R.ebitda}`, `${c}${R.ebit}+${c}${R.da}`, F.num, { italic: true });
  });
  w.calc(`${lastHist}${R.nwc}`, a("baseNwc"), F.num, { italic: true });

  projCols.forEach((c, i) => {
    const prev = i === 0 ? lastHist : projCols[i - 1];
    const byCase = (r: number[]) => `CHOOSE($C$${SW},${c}$${r[0]},${c}$${r[1]},${c}$${r[2]})`;
    w.calc(`${c}${R.rev}`, `${prev}${R.rev}*(1+${c}${R.growth})`, F.num, { bold: true });
    w.calc(`${c}${R.growth}`, byCase(CR.g), F.pct, { italic: true });
    w.calc(`${c}${R.ebit}`, `${c}${R.rev}*${c}${R.margin}`, F.num);
    w.calc(`${c}${R.margin}`, byCase(CR.m), F.pct, { italic: true });
    w.calc(`${c}${R.taxes}`, `-${c}${R.ebit}*${a("tax")}`, F.num);
    w.calc(`${c}${R.nopat}`, `${c}${R.ebit}+${c}${R.taxes}`, F.num, { bold: true });
    w.calc(`${c}${R.da}`, `${c}${R.rev}*${a("da")}`, F.num);
    w.calc(`${c}${R.capex}`, `-${c}${R.rev}*${a("capex")}`, F.num);
    w.calc(`${c}${R.dnwc}`, `-(${c}${R.nwc}-${prev}${R.nwc})`, F.num);
    w.calc(`${c}${R.ufcf}`, `${c}${R.nopat}+${c}${R.da}+${c}${R.capex}+${c}${R.dnwc}`, F.num, { bold: true });
    w.calc(`${c}${R.ebitda}`, `${c}${R.ebit}+${c}${R.da}`, F.num, { italic: true });
    w.calc(`${c}${R.nwc}`, `${c}${R.rev}*${a("nwc")}`, F.num, { italic: true });
    w.calc(`${c}${R.period}`, `${i + 1}-0.5*${a("mid")}`, F.period);
    w.calc(`${c}${R.df}`, `1/(1+${WACC})^${c}${R.period}`, F.factor);
    w.calc(`${c}${R.pv}`, `${c}${R.ufcf}*${c}${R.df}`, F.num, { bold: true });
  });
  w.total(R.nopat, projCols);
  w.total(R.ufcf, allCols);
  w.note(R.taxes, "EBIT × tax rate, projected years only.");
  w.note(R.period, "With the mid-year convention, each year's cash is treated as arriving halfway through the year.");

  // ---------------- WACC ----------------
  w.section(80, "Discount rate (WACC)");
  const line = (r: number, text: string, f: string, fmt: string, bold = false) => {
    w.label(r, text, bold ? { bold: true } : { indent: 1 });
    w.calc(`C${r}`, f, fmt, { bold });
  };
  line(81, "Market value of equity", `${a("price")}*${a("shares")}`, F.num);
  line(82, "Total debt", a("debt"), F.num);
  line(83, "Equity / total capital", "IF(C81+C82=0,1,C81/(C81+C82))", F.pct);
  line(84, "Debt / total capital", "1-C83", F.pct);
  line(85, "Cost of equity (risk-free rate + beta × ERP)", `${a("rf")}+${a("beta")}*${a("erp")}`, F.pct2);
  line(86, "After-tax cost of debt", `${a("kd")}*(1-${a("tax")})`, F.pct2);
  line(87, "WACC", "C83*C85+C84*C86", F.pct2, true);
  w.total(87, ["C"]);

  // ---------------- Valuation ----------------
  w.section(89, "Valuation");
  line(90, "PV of free cash flow, years 1 to 5", `SUM(${projCols[0]}${R.pv}:${lastProj}${R.pv})`, F.num);
  line(91, "Terminal value at end of year 5", `IF(${a("method")}=1,${lastProj}${R.ufcf}*(1+${a("g")})/(C87-${a("g")}),${lastProj}${R.ebitda}*${a("mult")})`, F.num);
  w.note(91, "Perpetuity growth: final-year FCF × (1 + g) / (WACC − g). Exit multiple: final-year EBITDA × multiple.");
  line(92, "PV of terminal value", "C91/(1+C87)^5", F.num);
  line(93, "Enterprise value", "C90+C92", F.num, true);
  w.total(93, ["C"]);
  line(94, "Less: total debt", `-${a("debt")}`, F.num);
  line(95, "Plus: cash and investments", a("cash"), F.num);
  line(96, "Equity value", "C93+C94+C95", F.num, true);
  w.total(96, ["C"]);
  line(97, "Diluted shares outstanding (millions)", a("shares"), F.num1);
  line(98, "Implied value per share", "C96/C97", F.price, true);
  w.final(98, ["C"]);
  line(99, "Current share price", a("price"), F.price);
  line(100, "Upside / (downside)", 'IF(C99=0,"",C98/C99-1)', F.pct);

  w.label(102, "Checks", { italic: true });
  line(103, "Terminal value, % of enterprise value", "C92/C93", F.pct);
  w.note(103, "Above about 75% means most of the value rests on the years after the forecast.");
  line(104, "Implied exit multiple (EV / EBITDA)", `C91/${lastProj}${R.ebitda}`, F.mult);
  line(105, "Implied perpetuity growth rate", `(C91*C87-${lastProj}${R.ufcf})/(C91+${lastProj}${R.ufcf})`, F.pct);

  // ---------------- Summary (top of the sheet) ----------------
  w.section(6, "Summary");
  line(7, "Implied value per share", "C98", F.price, true);
  line(8, "Current share price", "C99", F.price);
  line(9, "Upside / (downside)", "C100", F.pct);
  line(10, "Enterprise value", "C93", F.num);
  line(11, "Equity value", "C96", F.num);
  line(12, "WACC", "C87", F.pct2);
  line(13, "Case", `CHOOSE($C$${SW},"Bear","Base","Bull")`, "@");
  line(14, "Terminal value method", `IF(${a("method")}=1,"Perpetuity","Exit multiple")`, "@");
  w.note(7, "Every figure in this block is calculated further down the sheet.");

  buildSensitivity(wb, projCols, lastProj);
  buildScenarios(wb, sc, labels, projCols, lastHist);
  return wb;
}

const STEP_FONT = { name: FONT, size: 8, color: C.input };

// ---------------- Sensitivity ----------------
function buildSensitivity(wb: ExcelJSType.Workbook, projCols: string[], lastProj: string) {
  const w = sheet(wb, "Sensitivity", { labelWidth: 34, dataCols: 6, dataWidth: 12 });
  titleBlock(w, "Sensitivity analysis", "Implied value per share", "Live formulas linked to the DCF sheet. The boxed cell in each table matches the DCF sheet.");
  const D = (k: AKey) => `DCF!${a(k)}`;
  const fcf = `DCF!$${projCols[0]}$${R.ufcf}:$${lastProj}$${R.ufcf}`;
  const period = `DCF!$${projCols[0]}$${R.period}:$${lastProj}$${R.period}`;
  const perShare = (ev: string) => `((${ev})-${D("debt")}+${D("cash")})/${D("shares")}`;
  const pvFcf = (wacc: string) => `SUMPRODUCT(${fcf},1/(1+${wacc})^${period})`;
  const cols = ["D", "E", "F", "G", "H"];

  const table = (top: number, title: string, across: string, steps: number[], base: string, fmt: string, stepFmt: string, price: (wacc: string, t: string) => string) => {
    w.section(top, title);
    const stepRow = top + 1;
    const headRow = top + 2;
    w.text(`B${stepRow}`, "Step from the DCF sheet", { italic: true, gray: true, size: 8 });
    w.text(`B${headRow}`, `WACC (down), ${across} (across)`, { bold: true });
    steps.forEach((d, j) => {
      w.input(`${cols[j]}${stepRow}`, d, stepFmt).font = STEP_FONT;
      w.calc(`${cols[j]}${headRow}`, `${base}+${cols[j]}$${stepRow}`, fmt, { bold: true });
      w.ws.getCell(`${cols[j]}${headRow}`).border = { bottom: borders.thin };
    });
    [-0.01, -0.005, 0, 0.005, 0.01].forEach((d, i) => {
      const r = headRow + 1 + i;
      w.input(`B${r}`, d, F.pct2Step).font = STEP_FONT;
      w.calc(`C${r}`, `DCF!${WACC}+$B${r}`, F.pct2, { bold: true });
      w.ws.getCell(`C${r}`).border = { right: borders.thin };
      cols.forEach((c, j) => w.calc(`${c}${r}`, price(`$C${r}`, `${c}$${headRow}`), F.price, { bold: i === 2 && j === 2 }));
    });
    w.ws.getCell(`F${headRow + 3}`).border = { top: borders.thin, bottom: borders.thin, left: borders.thin, right: borders.thin };
  };
  table(6, "Perpetuity growth method", "terminal growth", [-0.01, -0.005, 0, 0.005, 0.01], D("g"), F.pct, F.pctStep, (wacc, t) =>
    `IF(${wacc}<=${t},"n/a",${perShare(`${pvFcf(wacc)}+DCF!$${lastProj}$${R.ufcf}*(1+${t})/(${wacc}-${t})/(1+${wacc})^5`)})`,
  );
  table(16, "Exit multiple method", "exit multiple", [-4, -2, 0, 2, 4], D("mult"), F.mult, F.multStep, (wacc, t) =>
    perShare(`${pvFcf(wacc)}+DCF!$${lastProj}$${R.ebitda}*${t}/(1+${wacc})^5`),
  );
  w.text("B26", "The small blue steps are inputs: change one to widen or narrow a table. The DCF sheet uses whichever method its terminal method cell selects.", {
    italic: true, gray: true, size: 8,
  });
}

// ---------------- Scenarios ----------------
function buildScenarios(wb: ExcelJSType.Workbook, sc: ReturnType<typeof getScenarios>, labels: string[], projCols: string[], lastHist: string) {
  const w = sheet(wb, "Scenarios", { labelWidth: 40, dataCols: 5, dataWidth: 12 });
  titleBlock(w, "Bull, base and bear cases", "Probability-weighted value per share", "($ in millions, except per share data). Each case is a full DCF built from its inputs on the DCF sheet.");
  const D = (k: AKey) => `DCF!${a(k)}`;
  const P = ["C", "D", "E", "F", "G"];
  const wacc = `DCF!${WACC}`;

  w.section(6, "Summary");
  w.text("B7", "Case", { bold: true });
  w.ws.getCell("B7").border = { bottom: borders.thin };
  w.heads(7, ["C", "D"], ["Value / share", "Probability"]);

  const SIZE = 16;
  SCENARIO_IDS.forEach((id, k) => {
    const top = 15 + k * SIZE;
    const rr = {
      rev: top + 2, ebit: top + 3, nopat: top + 4, da: top + 5, capex: top + 6, dnwc: top + 7,
      ufcf: top + 8, nwc: top + 9, ebitda: top + 10, pv: top + 11, tv: top + 12, ev: top + 13, price: top + 14,
    };
    w.section(top, `${SCENARIO_LABEL[id]} case`);
    w.heads(top + 1, P, labels.map((l) => `${l}E`));
    const rows: [number, string, { bold?: boolean; indent?: number; italic?: boolean }?][] = [
      [rr.rev, "Revenue", { bold: true }], [rr.ebit, "Operating income (EBIT)"], [rr.nopat, "NOPAT"],
      [rr.da, "Plus: depreciation and amortization"], [rr.capex, "Less: capital expenditures"],
      [rr.dnwc, "Less: increase in working capital"], [rr.ufcf, "Unlevered free cash flow", { bold: true }],
      [rr.nwc, "Memo: working capital", { italic: true }], [rr.ebitda, "Memo: EBITDA", { italic: true }],
      [rr.pv, "Present value of free cash flow"], [rr.tv, "Terminal value at end of year 5"],
      [rr.ev, "Enterprise value", { bold: true }], [rr.price, "Implied value per share", { bold: true }],
    ];
    for (const [r, t, o] of rows) w.label(r, t, o);
    P.forEach((c, i) => {
      const d = projCols[i];
      const prev = i === 0 ? `DCF!$${lastHist}$${R.rev}` : `${P[i - 1]}${rr.rev}`;
      w.calc(`${c}${rr.rev}`, `${prev}*(1+DCF!$${d}$${CR.g[k]})`, F.num, { bold: true });
      w.calc(`${c}${rr.ebit}`, `${c}${rr.rev}*DCF!$${d}$${CR.m[k]}`, F.num);
      w.calc(`${c}${rr.nopat}`, `${c}${rr.ebit}*(1-${D("tax")})`, F.num);
      w.calc(`${c}${rr.da}`, `${c}${rr.rev}*${D("da")}`, F.num);
      w.calc(`${c}${rr.capex}`, `-${c}${rr.rev}*DCF!$${colL(3 + k)}$${CR.capex}`, F.num);
      w.calc(`${c}${rr.nwc}`, `${c}${rr.rev}*${D("nwc")}`, F.num, { italic: true });
      const prevNwc = i === 0 ? D("baseNwc") : `${P[i - 1]}${rr.nwc}`;
      w.calc(`${c}${rr.dnwc}`, `-(${c}${rr.nwc}-${prevNwc})`, F.num);
      w.calc(`${c}${rr.ufcf}`, `${c}${rr.nopat}+${c}${rr.da}+${c}${rr.capex}+${c}${rr.dnwc}`, F.num, { bold: true });
      w.calc(`${c}${rr.ebitda}`, `${c}${rr.ebit}+${c}${rr.da}`, F.num, { italic: true });
      w.calc(`${c}${rr.pv}`, `${c}${rr.ufcf}/(1+${wacc})^DCF!$${d}$${R.period}`, F.num);
    });
    w.total(rr.ufcf, P);
    const tg = `DCF!$${colL(3 + k)}$${CR.tg}`;
    const mult = `DCF!$${colL(3 + k)}$${CR.mult}`;
    w.calc(`C${rr.tv}`, `IF(${D("method")}=1,IF(${wacc}<=${tg},NA(),G${rr.ufcf}*(1+${tg})/(${wacc}-${tg})),G${rr.ebitda}*${mult})`, F.num);
    w.calc(`C${rr.ev}`, `SUM(C${rr.pv}:G${rr.pv})+C${rr.tv}/(1+${wacc})^5`, F.num, { bold: true });
    w.total(rr.ev, ["C"]);
    w.calc(`C${rr.price}`, `(C${rr.ev}-${D("debt")}+${D("cash")})/${D("shares")}`, F.price, { bold: true });
    w.final(rr.price, ["C"]);

    const r = 8 + k;
    w.label(r, SCENARIO_LABEL[id], { indent: 1 });
    w.calc(`C${r}`, `IFERROR(C${rr.price},"n/a")`, F.price);
    w.input(`D${r}`, sc.weights[id], "0%_)");
  });
  w.label(11, "Probability-weighted value per share", { bold: true });
  w.calc("C11", "SUMPRODUCT(C8:C10,D8:D10)/SUM(D8:D10)", F.price, { bold: true });
  w.final(11, ["C"]);
  w.calc("D11", "SUM(D8:D10)", "0%_)");
  w.total(11, ["D"]);
  w.label(12, "Current share price", { indent: 1 });
  w.calc("C12", D("price"), F.price);
  w.label(13, "Upside / (downside)", { indent: 1 });
  w.calc("C13", 'IF(C12=0,"",C11/C12-1)', F.pct);
}

/** File name like "Valora_AAPL_FY2026.xlsx" */
export function workbookName(inputs: DcfInputs): string {
  const id = (inputs.company.ticker || inputs.company.name || "model").replace(/[^A-Za-z0-9-]/g, "");
  return `Valora_${id || "model"}_${inputs.company.baseYearLabel}.xlsx`;
}

export { runDcf, baseYear };
