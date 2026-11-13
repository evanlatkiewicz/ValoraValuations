// Picks the Treasury yield for an option's life from the curve.
import { yieldAt, type Rates } from "./curve";
import { fmtDate } from "./market";
import { daysBetween, type OptionModel } from "./optionModel";

const years = (from: string, to: string) => Math.max(daysBetween(from, to), 0.5) / 365;

/** The Treasury yield matching an option's life, or the 10-year if the curve isn't available. */
export function matchedRate(rates: Rates, from: string, to: string): Pick<OptionModel, "treasury" | "treasuryDate"> {
  const y = rates.curve ? yieldAt(rates.curve, years(from, to)) : null;
  return y ? { treasury: y.rate, treasuryDate: rates.curve!.date } : { treasury: rates.rate, treasuryDate: rates.date };
}

export function rateNote(rates: Rates, from: string, to: string): string {
  const y = rates.curve ? yieldAt(rates.curve, years(from, to)) : null;
  if (y && rates.curve) return `Treasury yield for ${daysBetween(from, to)} days to expiration. ${y.how} on ${fmtDate(rates.curve.date)}, from FRED.`;
  return rates.live && rates.date ? `10-year Treasury yield on ${fmtDate(rates.date)}, from FRED.` : "Valora's default. Check today's Treasury yields.";
}
