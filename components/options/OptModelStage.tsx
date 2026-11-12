"use client";

import type { OptCtx } from "./OptionsTool";
import { OptLive } from "./OptLive";
import { useWidth } from "../useWidth";
import { npdf } from "@/lib/options";
import { pct, price } from "@/lib/format";

const f4 = (x: number) => (Number.isFinite(x) ? x.toFixed(4) : "n/a");

/** Bell curve with the area to the left of d2 shaded: the chance the call finishes in the money. */
function NormalCurve({ d1, d2 }: { d1: number; d2: number }) {
  const [ref, w] = useWidth<HTMLDivElement>(520);
  const H = 190, L = 16, R = 16, T = 22, B = 30;
  const lo = -3.5, hi = 3.5;
  const x = (z: number) => L + ((w - L - R) * (z - lo)) / (hi - lo);
  const y = (p: number) => H - B - (H - B - T) * (p / 0.4);
  const pts: string[] = [];
  for (let z = lo; z <= hi + 1e-9; z += 0.05) pts.push(`${x(z).toFixed(1)},${y(npdf(z)).toFixed(1)}`);
  const cut = Math.max(lo, Math.min(hi, d2));
  const area: string[] = [`${x(lo)},${y(0)}`];
  for (let z = lo; z <= cut + 1e-9; z += 0.05) area.push(`${x(z).toFixed(1)},${y(npdf(z)).toFixed(1)}`);
  area.push(`${x(cut)},${y(npdf(cut))}`, `${x(cut)},${y(0)}`);
  const mark = (z: number, label: string, color: string, dy: number) => {
    const zc = Math.max(lo, Math.min(hi, z));
    return (
      <g>
        <line x1={x(zc)} x2={x(zc)} y1={T - 6} y2={y(0)} stroke={color} strokeWidth={2} strokeDasharray={label === "d1" ? "4 3" : undefined} />
        <text x={x(zc)} y={T - 10 + dy} textAnchor="middle" fontSize="12" fontWeight={700} fill={color}>{label} = {z.toFixed(2)}</text>
      </g>
    );
  };
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Standard normal curve with the area below d2 shaded">
        <polygon points={area.join(" ")} fill="#d6e4d6" />
        <polyline points={pts.join(" ")} fill="none" stroke="#18201c" strokeWidth={2} />
        <line x1={L} x2={w - R} y1={y(0)} y2={y(0)} stroke="#7f9a78" />
        {[-3, -2, -1, 0, 1, 2, 3].map((z) => (
          <text key={z} x={x(z)} y={H - 10} textAnchor="middle" fontSize="11" fill="#7a857e" fontFamily="var(--mono)">{z}</text>
        ))}
        {mark(d2, "d2", "#2f5d46", 0)}
        {Math.abs(d1 - d2) > 0.15 && mark(d1, "d1", "#2b5aa0", 0)}
      </svg>
    </div>
  );
}

export function OptModelStage({ ctx }: { ctx: OptCtx }) {
  const { m, run } = ctx;
  const { S, K, T, r, q, sigma } = run.inputs;
  const R = run.result;
  const sqrtT = Math.sqrt(T);

  if (!run.valid) {
    return (
      <div className="bench wide">
        <div className="empty">
          <h2>The formula needs a valid contract</h2>
          <p>Set a strike above zero, a volatility above zero and an expiration after today.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => ctx.go("contract")}>Go to the contract</button>
        </div>
        <OptLive ctx={ctx} />
      </div>
    );
  }

  const Step = ({ n, title, words, math, result }: { n: number; title: string; words: string; math: string; result: string }) => (
    <div className="bs-step">
      <span className="bs-n">{n}</span>
      <div>
        <h3>{title}</h3>
        <p className="muted">{words}</p>
        <pre className="math">{math}</pre>
        <div className="bs-result">{result}</div>
      </div>
    </div>
  );

  return (
    <div className="bench wide">
      <section>
        <div className="step">
          <h1>The Black-Scholes formula, step by step</h1>
          <p className="lede">
            The model prices an option as the expected payoff at expiration, discounted back to today, assuming the stock&rsquo;s returns
            follow a normal distribution with the volatility you chose. Every number below comes from your contract.
          </p>
        </div>

        <div className="ledger" style={{ maxWidth: 640, marginTop: 24 }}>
          <div className="ledger-row"><span>S, share price</span><span className="num">{price(S)}</span></div>
          <div className="ledger-row"><span>K, strike</span><span className="num">{price(K)}</span></div>
          <div className="ledger-row"><span>T, years to expiration<div className="formula">{run.days} days / 365</div></span><span className="num">{T.toFixed(4)}</span></div>
          <div className="ledger-row"><span>r, risk-free rate (continuous)<div className="formula">2 × ln(1 + {pct(m.treasury, 2)} / 2)</div></span><span className="num">{pct(r, 3)}</span></div>
          <div className="ledger-row"><span>q, dividend yield</span><span className="num">{pct(q, 2)}</span></div>
          <div className="ledger-row"><span>σ, volatility</span><span className="num">{pct(sigma, 2)}</span></div>
        </div>

        <div className="bs-steps">
          <Step
            n={1}
            title="d1: how far in the money, in standard deviations"
            words="It compares the stock price to the strike, adjusts for the drift from interest and dividends over the time left, and scales by how much the stock can move in that time."
            math={`d1 = [ln(S / K) + (r − q + σ² / 2) × T] / (σ × √T)\n   = [ln(${S.toFixed(2)} / ${K.toFixed(2)}) + (${r.toFixed(4)} − ${q.toFixed(4)} + ${(sigma * sigma / 2).toFixed(4)}) × ${T.toFixed(4)}] / (${sigma.toFixed(4)} × ${sqrtT.toFixed(4)})\n   = [${Math.log(S / K).toFixed(4)} + ${((r - q + (sigma * sigma) / 2) * T).toFixed(4)}] / ${(sigma * sqrtT).toFixed(4)}`}
            result={`d1 = ${f4(R.d1)}`}
          />
          <Step
            n={2}
            title="d2: the same, one volatility-adjusted step lower"
            words="d2 subtracts the stock's expected movement over the life of the option. N(d2) is the model's probability that the call finishes in the money."
            math={`d2 = d1 − σ × √T = ${f4(R.d1)} − ${(sigma * sqrtT).toFixed(4)}`}
            result={`d2 = ${f4(R.d2)}`}
          />
          <div className="bs-step">
            <span className="bs-n">3</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>Turn them into probabilities</h3>
              <p className="muted">
                N(x) is the share of a standard normal curve to the left of x. The shaded area is N(d2) = {pct(R.Nd2, 1)}: the model&rsquo;s
                chance that the stock ends above {price(K)}, so the call finishes in the money. The put&rsquo;s chance is the rest,{" "}
                {pct(1 - R.Nd2, 1)}.
              </p>
              <NormalCurve d1={R.d1} d2={R.d2} />
              <div className="bs-probs">
                <span>N(d1) = <b className="num">{f4(R.Nd1)}</b></span>
                <span>N(d2) = <b className="num">{f4(R.Nd2)}</b></span>
                <span>N(−d1) = <b className="num">{f4(1 - R.Nd1)}</b></span>
                <span>N(−d2) = <b className="num">{f4(1 - R.Nd2)}</b></span>
              </div>
            </div>
          </div>
          <Step
            n={4}
            title="Call price"
            words="What you expect to receive (the stock, weighted by N(d1)) minus what you expect to pay (the strike, weighted by N(d2)), both in today's dollars."
            math={`Call = S × e^(−qT) × N(d1) − K × e^(−rT) × N(d2)\n     = ${S.toFixed(2)} × ${Math.exp(-q * T).toFixed(4)} × ${f4(R.Nd1)} − ${K.toFixed(2)} × ${Math.exp(-r * T).toFixed(4)} × ${f4(R.Nd2)}\n     = ${(R.discountedS * R.Nd1).toFixed(4)} − ${(R.discountedK * R.Nd2).toFixed(4)}`}
            result={`Call = ${price(R.call)}`}
          />
          <Step
            n={5}
            title="Put price"
            words="The mirror image: what you expect to receive for selling at the strike, minus the value of the stock you hand over."
            math={`Put = K × e^(−rT) × N(−d2) − S × e^(−qT) × N(−d1)\n    = ${K.toFixed(2)} × ${Math.exp(-r * T).toFixed(4)} × ${f4(1 - R.Nd2)} − ${S.toFixed(2)} × ${Math.exp(-q * T).toFixed(4)} × ${f4(1 - R.Nd1)}\n    = ${(R.discountedK * (1 - R.Nd2)).toFixed(4)} − ${(R.discountedS * (1 - R.Nd1)).toFixed(4)}`}
            result={`Put = ${price(R.put)}`}
          />
          <Step
            n={6}
            title="Check: put-call parity"
            words="A call minus a put with the same strike and date must equal the stock minus the strike, both in today's dollars. If it doesn't, there's a free-money trade, so the two prices have to line up."
            math={`Call − Put = S × e^(−qT) − K × e^(−rT)\n${R.call.toFixed(4)} − ${R.put.toFixed(4)} = ${R.discountedS.toFixed(4)} − ${R.discountedK.toFixed(4)}\n${(R.call - R.put).toFixed(4)} = ${(R.discountedS - R.discountedK).toFixed(4)}`}
            result={Math.abs(R.call - R.put - (R.discountedS - R.discountedK)) < 1e-6 ? "Both sides match" : "Mismatch"}
          />
        </div>

        <div className="step-nav">
          <button className="btn ghost" onClick={() => ctx.go("contract")}>Back to the contract</button>
          <button className="btn" onClick={() => ctx.go("results")}>See the valuation</button>
        </div>
      </section>
      <OptLive ctx={ctx} />
    </div>
  );
}
