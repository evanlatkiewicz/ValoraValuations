const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Accounting style: 1,234 and (1,234) for negatives. Millions. */
export function money(n: number): string {
  if (!isFinite(n)) return "n/a";
  const s = nf0.format(Math.abs(Math.round(n)));
  return n < -0.5 ? `(${s})` : s;
}

export function moneyB(n: number): string {
  if (!isFinite(n)) return "n/a";
  const b = n / 1000;
  const s = Math.abs(b) >= 100 ? b.toFixed(0) : b.toFixed(1);
  return `$${Number(s).toLocaleString("en-US")}B`;
}

export function pct(x: number, d = 1): string {
  if (!isFinite(x)) return "n/a";
  return `${(x * 100).toFixed(d)}%`;
}

export function signedPct(x: number, d = 1): string {
  if (!isFinite(x)) return "n/a";
  return `${x > 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
}

export function price(n: number): string {
  if (!isFinite(n)) return "n/a";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function mult(n: number): string {
  if (!isFinite(n)) return "n/a";
  return `${n.toFixed(1)}x`;
}

export const isNeg = (n: number) => isFinite(n) && n < -0.5;
