"""Reads the recalculated workbook and writes excel-results.json."""
import json
import os
from openpyxl import load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
wb = load_workbook(os.path.join(HERE, "recalc", "valora-check.xlsx"), data_only=True)
out = {}
for ws in wb.worksheets:
    out[ws.title] = {
        "wacc": ws["B24"].value,
        "tv": ws["B50"].value,
        "pvTv": ws["B51"].value,
        "sumPv": ws["B52"].value,
        "ev": ws["B53"].value,
        "equity": ws["B54"].value,
        "price": ws["B55"].value,
        "ufcf5": ws["B56"].value,
    }
json.dump(out, open(os.path.join(HERE, "excel-results.json"), "w"), indent=2)
print(json.dumps(out, indent=2))
