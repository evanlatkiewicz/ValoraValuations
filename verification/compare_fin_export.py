"""Compares LibreOffice-recalculated bank-model exports with the engine."""
import json, os, sys
from openpyxl import load_workbook
HERE = os.path.dirname(os.path.abspath(__file__))
CELLS = {"costOfEquity": "C14", "sumPv": "C28", "tvPv": "C31", "equity": "C32", "perShare": "C33", "impliedPb": "C35"}
exp = json.load(open(os.path.join(HERE, "export-fin", "expected.json")))
worst = 0
for t, e in exp.items():
    ws = load_workbook(os.path.join(HERE, "export-fin", "recalc", f"{t}.xlsx"), data_only=True)["Excess return"]
    for k, c in CELLS.items():
        g = ws[c].value
        if g is None: print(t, k, "EMPTY"); sys.exit(1)
        rel = abs(g - e[k]) / max(1, abs(e[k]))
        worst = max(worst, rel)
        if rel > 1e-9: print(f"MISMATCH {t} {k}: excel {g} engine {e[k]}"); sys.exit(1)
    print(f"{t:5s} value/share {ws['C33'].value:10.2f}  P/B {ws['C35'].value:.2f}  ok")
print("worst relative difference", worst)
