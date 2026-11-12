// Bear, base and bull cases. The base case is the model itself; bull and
// bear override only the beliefs about the business (growth, margins, capex,
// terminal value). Facts and risk (history, balance sheet, price, discount
// rate) are shared by all three.

import { runChecks, starRating } from "./checks";
import { computeWacc, runDcf } from "./dcf";
import type { DcfInputs, DcfResult } from "./types";

export type ScenarioId = "bear" | "base" | "bull";
export const SCENARIO_IDS: ScenarioId[] = ["bear", "base", "bull"];
export const SCENARIO_LABEL: Record<ScenarioId, string> = { bear: "Bear", base: "Base", bull: "Bull" };

export const CASE_FIELDS = ["revenueGrowth", "ebitMargin", "capexPct", "terminalGrowth", "exitMultiple"] as const;
export type CaseField = (typeof CASE_FIELDS)[number];
export type CaseValues = Pick<DcfInputs, CaseField>;

export interface Weights {
  bear: number;
  base: number;
  bull: number;
}

export interface Scenarios {
  bear: CaseValues;
  bull: CaseValues;
  weights: Weights;
}

export const DEFAULT_WEIGHTS: Weights = { bear: 0.25, base: 0.5, bull: 0.25 };

const r4 = (x: number) => Number(x.toFixed(4));

/** Starting bull (dir = 1) or bear (dir = -1) case, shifted from the base case. */
export function defaultCase(base: DcfInputs, dir: 1 | -1): CaseValues {
  const wacc = computeWacc(base).wacc;
  const g = base.terminalGrowth + 0.005 * dir;
  return {
    revenueGrowth: base.revenueGrowth.map((x) => r4(x + 0.02 * dir)),
    ebitMargin: base.ebitMargin.map((x) => r4(Math.max(-0.5, x + 0.015 * dir))),
    capexPct: base.capexPct,
    terminalGrowth: r4(dir > 0 ? Math.min(g, wacc - 0.01) : Math.max(g, 0)),
    exitMultiple: r4(Math.max(1, base.exitMultiple + 2 * dir)),
  };
}

/** The saved cases, or starting ones derived from the base case. */
export function getScenarios(i: DcfInputs): Scenarios {
  return i.scenarios ?? { bear: defaultCase(i, -1), bull: defaultCase(i, 1), weights: DEFAULT_WEIGHTS };
}

export function caseValues(i: DcfInputs, id: ScenarioId): CaseValues {
  if (id === "base") return pickCase(i);
  return getScenarios(i)[id];
}

export function pickCase(i: DcfInputs): CaseValues {
  return {
    revenueGrowth: i.revenueGrowth,
    ebitMargin: i.ebitMargin,
    capexPct: i.capexPct,
    terminalGrowth: i.terminalGrowth,
    exitMultiple: i.exitMultiple,
  };
}

/** Full model inputs for one case. */
export function caseInputs(i: DcfInputs, id: ScenarioId): DcfInputs {
  return id === "base" ? i : { ...i, ...getScenarios(i)[id] };
}

export function isCaseField(f: string): f is CaseField {
  return (CASE_FIELDS as readonly string[]).includes(f);
}

/** Normalize weights so they add to 1. Falls back to 25/50/25. */
export function normalize(w: Weights): Weights {
  const t = w.bear + w.base + w.bull;
  if (!(t > 0) || [w.bear, w.base, w.bull].some((x) => !(x >= 0))) return DEFAULT_WEIGHTS;
  return { bear: w.bear / t, base: w.base / t, bull: w.bull / t };
}

export interface CaseResult {
  id: ScenarioId;
  inputs: DcfInputs;
  result: DcfResult;
  value: number;
  stars: number;
  weight: number;
}

export interface DriverStep {
  label: string;
  delta: number; // change in value per share from this assumption
}

export interface Analysis {
  cases: Record<ScenarioId, CaseResult>;
  weights: Weights;
  expected: number; // probability-weighted value per share
  expectedUpside: number;
  stdev: number; // weighted standard deviation of value per share
  cv: number; // stdev / expected
  upsideToBull: number; // bull - base
  downsideToBear: number; // base - bear
  skew: number; // upside / downside ratio
  probAbovePrice: number; // weight of cases worth more than today's price
  impliedBullProb: number | null; // p where p*bull + (1-p)*bear = price, if the price is between them
  priceVsRange: "below" | "inside" | "above";
  drivers: Record<"bull" | "bear", DriverStep[]>;
  valid: boolean; // false if any case has no meaningful value
}

const DRIVERS: { label: string; fields: CaseField[] }[] = [
  { label: "Revenue growth", fields: ["revenueGrowth"] },
  { label: "Operating margin", fields: ["ebitMargin"] },
  { label: "Capex", fields: ["capexPct"] },
  { label: "Terminal value", fields: ["terminalGrowth", "exitMultiple"] },
];

/**
 * Walk from the base case to another case one assumption at a time, and
 * record how much each step moves the value per share. The steps add up to
 * the full difference. The order is fixed (growth, margin, capex, terminal),
 * which matters a little because the effects interact.
 */
export function driverSteps(i: DcfInputs, target: "bull" | "bear"): DriverStep[] {
  const goal = getScenarios(i)[target];
  let cur: DcfInputs = i;
  let prev = runDcf(cur).impliedPrice;
  return DRIVERS.map(({ label, fields }) => {
    const patch: Partial<DcfInputs> = {};
    for (const f of fields) (patch as Record<string, unknown>)[f] = goal[f];
    cur = { ...cur, ...patch };
    const v = runDcf(cur).impliedPrice;
    const step = { label, delta: v - prev };
    prev = v;
    return step;
  });
}

export function analyze(i: DcfInputs): Analysis {
  const w = normalize(getScenarios(i).weights);
  const cases = Object.fromEntries(
    SCENARIO_IDS.map((id) => {
      const inputs = caseInputs(i, id);
      const result = runDcf(inputs);
      return [id, { id, inputs, result, value: result.impliedPrice, stars: starRating(runChecks(inputs, result)), weight: w[id] }];
    }),
  ) as Record<ScenarioId, CaseResult>;

  const vals = SCENARIO_IDS.map((id) => cases[id].value);
  const valid = vals.every((v) => Number.isFinite(v)) && SCENARIO_IDS.every((id) => cases[id].result.terminal.valid);
  const expected = SCENARIO_IDS.reduce((s, id) => s + w[id] * cases[id].value, 0);
  const variance = SCENARIO_IDS.reduce((s, id) => s + w[id] * (cases[id].value - expected) ** 2, 0);
  const stdev = Math.sqrt(variance);
  const price = i.sharePrice;
  const bull = cases.bull.value, base = cases.base.value, bear = cases.bear.value;
  const upsideToBull = bull - base;
  const downsideToBear = base - bear;
  const lo = Math.min(bear, bull), hi = Math.max(bear, bull);

  return {
    cases,
    weights: w,
    expected,
    expectedUpside: price > 0 ? expected / price - 1 : NaN,
    stdev,
    cv: expected !== 0 ? stdev / Math.abs(expected) : NaN,
    upsideToBull,
    downsideToBear,
    skew: downsideToBear > 0 ? upsideToBull / downsideToBear : NaN,
    probAbovePrice: SCENARIO_IDS.reduce((s, id) => s + (cases[id].value > price ? w[id] : 0), 0),
    impliedBullProb: price >= lo && price <= hi && bull !== bear ? (price - bear) / (bull - bear) : null,
    priceVsRange: price < lo ? "below" : price > hi ? "above" : "inside",
    drivers: { bull: driverSteps(i, "bull"), bear: driverSteps(i, "bear") },
    valid,
  };
}

/** Light validation for scenarios read from a share link. */
export function validScenarios(s: unknown): s is Scenarios {
  const ok5 = (a: unknown) => Array.isArray(a) && a.length === 5 && a.every((x) => typeof x === "number" && Number.isFinite(x));
  const okCase = (c: unknown) => {
    const v = c as CaseValues;
    return !!v && ok5(v.revenueGrowth) && ok5(v.ebitMargin) && [v.capexPct, v.terminalGrowth, v.exitMultiple].every((x) => typeof x === "number" && Number.isFinite(x));
  };
  const sc = s as Scenarios;
  const w = sc?.weights;
  return !!sc && okCase(sc.bear) && okCase(sc.bull) && !!w && [w.bear, w.base, w.bull].every((x) => typeof x === "number" && x >= 0);
}
