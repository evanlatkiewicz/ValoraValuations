"""
Independent Black-Scholes check. Builds a workbook with plain Excel formulas
(NORMSDIST, with the normal density written out), one row per scenario. After LibreOffice recalculates it, the
test suite compares the engine's prices and Greeks to these cells.
Usage:
  python3 verification/options_check.py build
  soffice --headless --calc --convert-to xlsx --outdir verification/recalc verification/options-check.xlsx
  python3 verification/options_check.py extract
"""
import json, os, sys
from openpyxl import Workbook, load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
SCEN = [
    # name, S, K, T, r, q, sigma
    ("hull_15_6", 42, 40, 0.5, 0.10, 0.0, 0.20),       # Hull, Options Futures & Other Derivatives, Example 15.6
    ("atm_1y", 100, 100, 1.0, 0.05, 0.0, 0.25),
    ("deep_itm_div", 350, 250, 0.75, 0.0486, 0.004, 0.28),
    ("deep_otm_short", 126, 160, 0.08, 0.0486, 0.011, 0.22),
    ("high_vol_long", 398, 400, 2.0, 0.045, 0.0, 0.65),
]
COLS = ["S", "K", "T", "r", "q", "sigma", "d1", "d2", "call", "put", "c_delta", "p_delta", "gamma", "vega", "c_theta", "p_theta", "c_rho", "p_rho"]

def build():
    wb = Workbook(); ws = wb.active; ws.title = "BS"
    for j, h in enumerate(["name"] + COLS): ws.cell(1, j + 1, h)
    for i, (name, S, K, T, r, q, sig) in enumerate(SCEN):
        R = i + 2
        ws.cell(R, 1, name)
        for j, v in enumerate([S, K, T, r, q, sig]): ws.cell(R, j + 2, v)
        S_, K_, T_, r_, q_, s_ = (f"{c}{R}" for c in "BCDEFG")
        f = {
            "d1": f"=(LN({S_}/{K_})+({r_}-{q_}+{s_}^2/2)*{T_})/({s_}*SQRT({T_}))",
            "d2": f"=H{R}-{s_}*SQRT({T_})",
            "call": f"={S_}*EXP(-{q_}*{T_})*NORMSDIST(H{R})-{K_}*EXP(-{r_}*{T_})*NORMSDIST(I{R})",
            "put": f"={K_}*EXP(-{r_}*{T_})*NORMSDIST(-I{R})-{S_}*EXP(-{q_}*{T_})*NORMSDIST(-H{R})",
            "c_delta": f"=EXP(-{q_}*{T_})*NORMSDIST(H{R})",
            "p_delta": f"=-EXP(-{q_}*{T_})*NORMSDIST(-H{R})",
            "gamma": f"=EXP(-{q_}*{T_})*(EXP(-((H{R})^2)/2)/SQRT(2*PI()))/({S_}*{s_}*SQRT({T_}))",
            "vega": f"={S_}*EXP(-{q_}*{T_})*(EXP(-((H{R})^2)/2)/SQRT(2*PI()))*SQRT({T_})/100",
            "c_theta": f"=(-{S_}*EXP(-{q_}*{T_})*(EXP(-((H{R})^2)/2)/SQRT(2*PI()))*{s_}/(2*SQRT({T_}))-{r_}*{K_}*EXP(-{r_}*{T_})*NORMSDIST(I{R})+{q_}*{S_}*EXP(-{q_}*{T_})*NORMSDIST(H{R}))/365",
            "p_theta": f"=(-{S_}*EXP(-{q_}*{T_})*(EXP(-((H{R})^2)/2)/SQRT(2*PI()))*{s_}/(2*SQRT({T_}))+{r_}*{K_}*EXP(-{r_}*{T_})*NORMSDIST(-I{R})-{q_}*{S_}*EXP(-{q_}*{T_})*NORMSDIST(-H{R}))/365",
            "c_rho": f"={K_}*{T_}*EXP(-{r_}*{T_})*NORMSDIST(I{R})/100",
            "p_rho": f"=-{K_}*{T_}*EXP(-{r_}*{T_})*NORMSDIST(-I{R})/100",
        }
        for j, k in enumerate(COLS[6:]): ws.cell(R, 8 + j, f[k])
    wb.save(os.path.join(HERE, "options-check.xlsx")); print("built")

def extract():
    ws = load_workbook(os.path.join(HERE, "recalc", "options-check.xlsx"), data_only=True)["BS"]
    out = {}
    for i in range(len(SCEN)):
        R = i + 2
        out[ws.cell(R, 1).value] = {k: ws.cell(R, 2 + j).value for j, k in enumerate(COLS)}
    json.dump(out, open(os.path.join(HERE, "options-excel.json"), "w"), indent=2); print(json.dumps(out["hull_15_6"], indent=1))

{"build": build, "extract": extract}[sys.argv[1]]()
