"""
Builds an Excel DCF for the scenarios in scenarios.json using plain cell
formulas, written independently of the TypeScript engine. After LibreOffice
recalculates it, extract_results.py pulls the values so the test suite can
compare them with lib/dcf.ts.

Usage: python3 verification/build_check_workbook.py
"""
import json
import os
from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
scenarios = json.load(open(os.path.join(HERE, "scenarios.json")))

wb = Workbook()
wb.remove(wb.active)
cols = ["C", "D", "E", "F", "G"]  # projection years 1..5

for name, s in scenarios.items():
    ws = wb.create_sheet(name)
    # Assumptions block (column B)
    a = {
        "base_rev": s["history"][-1]["revenue"],
        "base_nwc": s["baseNwc"],
        "tax": s["taxRate"],
        "da": s["daPct"],
        "capex": s["capexPct"],
        "nwc": s["nwcPct"],
        "price": s["sharePrice"],
        "shares": s["sharesOutstanding"],
        "cash": s["cash"],
        "debt": s["debt"],
        "rf": s["riskFreeRate"],
        "beta": s["beta"],
        "erp": s["equityRiskPremium"],
        "kd": s["preTaxCostOfDebt"],
        "g": s["terminalGrowth"],
        "mult": s["exitMultiple"],
        "mid": 1 if s["midYear"] else 0,
        "gordon": 1 if s["terminalMethod"] == "gordon" else 0,
    }
    ref = {}
    for i, (k, v) in enumerate(a.items(), start=1):
        ws[f"A{i}"] = k
        ws[f"B{i}"] = v
        ref[k] = f"$B${i}"

    # WACC
    ws["A21"] = "mktcap"; ws["B21"] = f"={ref['price']}*{ref['shares']}"
    ws["A22"] = "we"; ws["B22"] = f"=B21/(B21+{ref['debt']})"
    ws["A23"] = "ke"; ws["B23"] = f"={ref['rf']}+{ref['beta']}*{ref['erp']}"
    ws["A24"] = "wacc"; ws["B24"] = f"=B22*B23+(1-B22)*{ref['kd']}*(1-{ref['tax']})"

    # Projections: rows 30..
    rows = ["growth", "margin", "rev", "ebit", "nopat", "da", "capex", "nwc", "dnwc", "ufcf", "period", "df", "pv", "ebitda"]
    r = {k: 30 + i for i, k in enumerate(rows)}
    for k, row in r.items():
        ws[f"A{row}"] = k
    for j, c in enumerate(cols):
        prev = cols[j - 1] if j > 0 else None
        ws[f"{c}{r['growth']}"] = s["revenueGrowth"][j]
        ws[f"{c}{r['margin']}"] = s["ebitMargin"][j]
        prev_rev = f"{prev}{r['rev']}" if prev else ref["base_rev"]
        prev_nwc = f"{prev}{r['nwc']}" if prev else ref["base_nwc"]
        ws[f"{c}{r['rev']}"] = f"={prev_rev}*(1+{c}{r['growth']})"
        ws[f"{c}{r['ebit']}"] = f"={c}{r['rev']}*{c}{r['margin']}"
        ws[f"{c}{r['nopat']}"] = f"={c}{r['ebit']}*(1-{ref['tax']})"
        ws[f"{c}{r['da']}"] = f"={c}{r['rev']}*{ref['da']}"
        ws[f"{c}{r['capex']}"] = f"={c}{r['rev']}*{ref['capex']}"
        ws[f"{c}{r['nwc']}"] = f"={c}{r['rev']}*{ref['nwc']}"
        ws[f"{c}{r['dnwc']}"] = f"={c}{r['nwc']}-{prev_nwc}"
        ws[f"{c}{r['ufcf']}"] = f"={c}{r['nopat']}+{c}{r['da']}-{c}{r['capex']}-{c}{r['dnwc']}"
        ws[f"{c}{r['period']}"] = f"={j + 1}-0.5*{ref['mid']}"
        ws[f"{c}{r['df']}"] = f"=1/(1+$B$24)^{c}{r['period']}"
        ws[f"{c}{r['pv']}"] = f"={c}{r['ufcf']}*{c}{r['df']}"
        ws[f"{c}{r['ebitda']}"] = f"={c}{r['ebit']}+{c}{r['da']}"

    # Terminal value and bridge
    ws["A50"] = "tv"
    ws["B50"] = (
        f"=IF({ref['gordon']}=1,G{r['ufcf']}*(1+{ref['g']})/($B$24-{ref['g']}),G{r['ebitda']}*{ref['mult']})"
    )
    ws["A51"] = "pv_tv"; ws["B51"] = "=B50/(1+$B$24)^5"
    ws["A52"] = "sum_pv"; ws["B52"] = f"=SUM(C{r['pv']}:G{r['pv']})"
    ws["A53"] = "ev"; ws["B53"] = "=B51+B52"
    ws["A54"] = "equity"; ws["B54"] = f"=B53-{ref['debt']}+{ref['cash']}"
    ws["A55"] = "price"; ws["B55"] = f"=B54/{ref['shares']}"
    ws["A56"] = "ufcf5"; ws["B56"] = f"=G{r['ufcf']}"

out = os.path.join(HERE, "valora-check.xlsx")
wb.save(out)
print("wrote", out)
