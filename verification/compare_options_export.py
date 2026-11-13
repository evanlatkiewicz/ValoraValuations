"""Compares LibreOffice-recalculated options exports with the engine."""
import json, os, sys
from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
CELLS = {"call": "C27", "put": "D27", "d1": "C18", "d2": "C19", "callDelta": "C36", "putDelta": "D36", "gamma": "C37",
         "vega": "C38", "callTheta": "C39", "putTheta": "D39", "callRho": "C40", "putRho": "D40", "parity": "C33"}
expected = json.load(open(os.path.join(HERE, "export-options", "expected.json")))
worst = 0.0
for name, exp in expected.items():
    wb = load_workbook(os.path.join(HERE, "export-options", "recalc", f"{name}.xlsx"), data_only=True)
    ws, ss = wb["Black-Scholes"], wb["Sensitivity"]
    got = {k: ws[c].value for k, c in CELLS.items()}
    got["sensCentre"], got["sensCorner"] = ss["E7"].value, ss["C5"].value
    for k, v in exp.items():
        g = got[k]
        if g is None:
            print(name, k, "EMPTY"); sys.exit(1)
        err = abs(g - v)
        worst = max(worst, err)
        if err > 2e-5:  # NORMSDIST and the engine's normal CDF differ around 1e-7
            print(f"MISMATCH {name} {k}: excel {g} vs engine {v}"); sys.exit(1)
    print(f"{name:16s} call {got['call']:.4f} put {got['put']:.4f} ok")
print("worst abs difference", worst)
