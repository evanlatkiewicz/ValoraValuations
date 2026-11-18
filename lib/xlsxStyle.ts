// Shared formatting for every Valora Excel export, following the conventions most
// banks use: one font, blue hard-coded inputs, black formulas, green links to other
// sheets, negatives in parentheses with figures lined up, rules above totals.

import type ExcelJSType from "exceljs";

type Workbook = ExcelJSType.Workbook;
type Worksheet = ExcelJSType.Worksheet;
type Cell = ExcelJSType.Cell;

export const FONT = "Arial";
export const C = {
  input: { argb: "FF0000FF" },
  link: { argb: "FF008000" },
  ink: { argb: "FF000000" },
  gray: { argb: "FF595959" },
  rule: { argb: "FF000000" },
};

// The "_)" padding leaves room for a closing parenthesis, so positives and negatives line up.
export const F = {
  num: '#,##0_);(#,##0);"–"_)',
  num1: '#,##0.0_);(#,##0.0);"–"_)',
  pct: '0.0%_);(0.0%);"–"_)',
  pct2: '0.00%_);(0.00%);"–"_)',
  price: '$#,##0.00_);($#,##0.00);"–"_)',
  mult: '0.0"x"_);(0.0"x")',
  multStep: '+0.0"x";-0.0"x";0.0"x"',
  pctStep: '+0.0%;-0.0%;0.0%',
  pct2Step: '+0.00%;-0.00%;0.00%',
  factor: "0.0000_)",
  period: "0.0_)",
  int: "0_)",
  date: "mmm d, yyyy",
};

/** A formula that only points at a cell on another sheet, which banks colour green. */
export const isLink = (f: string) => /^-?('[^']+'|[A-Za-z][\w]*)!\$?[A-Z]{1,3}\$?\d+$/.test(f.trim());

const thin = { style: "thin" as const, color: C.rule };
const medium = { style: "medium" as const, color: C.rule };
const double = { style: "double" as const, color: C.rule };

/** Column letter for a 1-based index. */
export const colL = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
export const colN = (l: string) => l.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

export interface Writer {
  ws: Worksheet;
  /** Plain label in column B. */
  label(row: number, text: string, o?: { bold?: boolean; indent?: number; italic?: boolean }): Cell;
  /** Hard-coded number (blue). */
  input(addr: string, v: number | Date | string, fmt: string, o?: { bold?: boolean }): Cell;
  /** Formula on this sheet (black) or linked from another sheet (green). */
  calc(addr: string, f: string, fmt: string, o?: { bold?: boolean; italic?: boolean }): Cell;
  /** Section title with a rule across the model's width. */
  section(row: number, text: string): void;
  /** Right-aligned column headings with a rule under them. */
  heads(row: number, cols: string[], texts: string[], o?: { rule?: boolean }): void;
  /** A small gray note in the notes column. */
  note(row: number, text?: string): void;
  /** Single rule above the given cells (a subtotal). */
  total(row: number, cols: string[]): void;
  /** Rule above and double rule below (the answer). */
  final(row: number, cols: string[]): void;
  text(addr: string, v: string, o?: { bold?: boolean; italic?: boolean; gray?: boolean; size?: number; align?: "left" | "right" | "center" }): Cell;
}

export function sheet(
  wb: Workbook,
  name: string,
  o: { labelWidth: number; dataCols: number; dataWidth?: number; notesWidth?: number; lastCol?: string },
): Writer {
  const ws = wb.addWorksheet(name, {
    properties: { defaultRowHeight: 13.5 },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 },
      horizontalCentered: true,
    },
    headerFooter: { oddFooter: `&L&"${FONT}"&8Valora&C&"${FONT}"&8&A&R&"${FONT}"&8Page &P of &N` },
  });
  ws.getColumn(1).width = 1.5;
  ws.getColumn(2).width = o.labelWidth;
  for (let i = 0; i < o.dataCols; i++) ws.getColumn(3 + i).width = o.dataWidth ?? 11.5;
  const notesCol = colL(3 + o.dataCols + 1);
  if (o.notesWidth) {
    ws.getColumn(3 + o.dataCols).width = 2;
    ws.getColumn(3 + o.dataCols + 1).width = o.notesWidth;
  }
  const lastData = o.lastCol ?? colL(2 + o.dataCols);
  const span = (from: string, to: string) => {
    const out: string[] = [];
    for (let n = colN(from); n <= colN(to); n++) out.push(colL(n));
    return out;
  };

  const font = (c: Cell, extra: Partial<ExcelJSType.Font>) => (c.font = { name: FONT, size: 10, color: C.ink, ...extra });
  const w: Writer = {
    ws,
    label(row, text, x = {}) {
      const c = ws.getCell(`B${row}`);
      c.value = text;
      font(c, { bold: !!x.bold, italic: !!x.italic });
      if (x.indent) c.alignment = { indent: x.indent };
      return c;
    },
    input(addr, v, fmt, x = {}) {
      const c = ws.getCell(addr);
      c.value = v;
      c.numFmt = fmt;
      font(c, { color: C.input, bold: !!x.bold });
      c.alignment = { horizontal: "right" };
      return c;
    },
    calc(addr, f, fmt, x = {}) {
      const c = ws.getCell(addr);
      c.value = { formula: f };
      c.numFmt = fmt;
      font(c, { color: isLink(f) ? C.link : C.ink, bold: !!x.bold, italic: !!x.italic });
      c.alignment = { horizontal: "right" };
      return c;
    },
    section(row, text) {
      const c = ws.getCell(`B${row}`);
      c.value = text;
      font(c, { bold: true, size: 10 });
      for (const col of span("B", lastData)) ws.getCell(`${col}${row}`).border = { bottom: medium };
      ws.getRow(row).height = 18;
      c.alignment = { vertical: "bottom" };
    },
    heads(row, cols, texts, x = { rule: true }) {
      cols.forEach((col, i) => {
        const c = ws.getCell(`${col}${row}`);
        c.value = texts[i];
        font(c, { bold: true });
        c.alignment = { horizontal: "right" };
        if (x.rule !== false) c.border = { bottom: thin };
      });
    },
    note(row, text) {
      if (!text || !o.notesWidth) return;
      const c = ws.getCell(`${notesCol}${row}`);
      c.value = text;
      font(c, { italic: true, color: C.gray, size: 8 });
    },
    total(row, cols) {
      for (const col of cols) ws.getCell(`${col}${row}`).border = { top: thin };
    },
    final(row, cols) {
      for (const col of cols) ws.getCell(`${col}${row}`).border = { top: thin, bottom: double };
    },
    text(addr, v, x = {}) {
      const c = ws.getCell(addr);
      c.value = v;
      font(c, { bold: !!x.bold, italic: !!x.italic, color: x.gray ? C.gray : C.ink, size: x.size ?? 10 });
      if (x.align) c.alignment = { horizontal: x.align };
      return c;
    },
  };
  return w;
}

/** Standard title block: company, model name, units line and the colour key. */
export function titleBlock(w: Writer, company: string, model: string, units: string, compact = false) {
  if (compact) {
    w.text("B1", `${company}: ${model}`, { bold: true, size: 14 });
  } else {
    w.text("B1", company, { bold: true, size: 14 });
    w.text("B2", model, { bold: true, size: 11 });
  }
  const key = w.ws.getCell(compact ? "B2" : "B4");
  if (!compact) w.text("B3", units, { italic: true, gray: true, size: 9 });
  key.value = {
    richText: [
      ...(compact ? [{ text: `${units}  `, font: { name: FONT, size: 8, italic: true, color: C.gray } }] : []),
      { text: "Blue", font: { name: FONT, size: 8, color: C.input, bold: true } },
      { text: " = input you can change.  ", font: { name: FONT, size: 8, color: C.gray } },
      { text: "Black", font: { name: FONT, size: 8, color: C.ink, bold: true } },
      { text: " = formula.  ", font: { name: FONT, size: 8, color: C.gray } },
      { text: "Green", font: { name: FONT, size: 8, color: C.link, bold: true } },
      { text: " = linked from another sheet.  Built with Valora.", font: { name: FONT, size: 8, color: C.gray } },
    ],
  };
}

export const borders = { thin, medium, double };
