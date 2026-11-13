import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { blackScholes } from "@/lib/options";

export const metadata: Metadata = {
  title: "How Black-Scholes works | Valora",
  description: "A plain-English walkthrough of the Black-Scholes option pricing model, the Greeks and implied volatility, with a worked example.",
};

// The worked example: a six-month call and put, struck $5 above a $100 stock.
const IN = { S: 100, K: 105, T: 0.5, r: 0.045, q: 0, sigma: 0.25 };
const R = blackScholes(IN);
const HIGH = blackScholes({ ...IN, sigma: 0.35 });
const $ = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
const f4 = (n: number) => n.toFixed(4);
const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

export default function Page() {
  const cg = R.callGreeks;
  const pg = R.putGreeks;
  return (
    <PageShell>
      <h1>How Black-Scholes works</h1>
      <p className="lede">
        An option is a contract that gives you the right, but not the obligation, to buy or sell a stock at a set price before a set date.
        Black-Scholes is the formula that puts a price on that right. It needs six numbers, and only one of them is a judgment call.
      </p>

      <h2>Calls and puts</h2>
      <p>
        A <b>call</b> lets you buy 100 shares at the strike price. It pays off when the stock ends above the strike. A <b>put</b> lets you
        sell 100 shares at the strike. It pays off when the stock ends below it. If the stock finishes on the wrong side of the strike, the
        option expires worthless and you lose what you paid for it, called the premium. Prices are quoted per share, so a quote of $2.00
        costs $200 for one contract.
      </p>
      <span className="formula-line">Call payoff at expiration = max(stock price − strike, 0)</span>
      <span className="formula-line">Put payoff at expiration = max(strike − stock price, 0)</span>

      <h2>The six inputs</h2>
      <ul>
        <li><b>Share price (S).</b> Today&rsquo;s price of the stock.</li>
        <li><b>Strike (K).</b> The price written into the contract.</li>
        <li><b>Time to expiration (T).</b> In years. Ninety days is 90 / 365 = 0.25.</li>
        <li><b>Risk-free rate (r).</b> The Treasury yield for the option's life, converted to continuous compounding. A 3-month option uses the 3-month bill, not the 10-year note.</li>
        <li><b>Dividend yield (q).</b> Dividends pay shareholders, not option holders, so they lower calls and raise puts.</li>
        <li>
          <b>Volatility (σ).</b> How much the stock is expected to move in a year, as a standard deviation of returns. It&rsquo;s the
          only input you can&rsquo;t look up, and it matters most.
        </li>
      </ul>

      <h2>A worked example</h2>
      <p>
        Take a stock at {$(IN.S)}, a strike of {$(IN.K)}, six months to expiration (T = {IN.T}), a {pct(IN.r, 1)} risk-free rate, no
        dividend and {pct(IN.sigma)} volatility.
      </p>

      <h3>1. Compute d1 and d2</h3>
      <p>
        d1 measures how far in the money the option is, in standard deviations, after accounting for the drift from interest over the
        time left. d2 is one volatility-sized step lower.
      </p>
      <span className="formula-line">d1 = [ln(S / K) + (r − q + σ² / 2) × T] / (σ × √T) = {f4(R.d1)}</span>
      <span className="formula-line">d2 = d1 − σ × √T = {f4(R.d2)}</span>

      <h3>2. Turn them into probabilities</h3>
      <p>
        N(x) is the share of a standard normal curve to the left of x. N(d2) = {f4(R.Nd2)} is the model&rsquo;s probability that the call
        finishes in the money, about {pct(R.Nd2)}. N(d1) = {f4(R.Nd1)} is the same idea weighted by how far in the money it ends up. It
        also turns out to be the call&rsquo;s delta.
      </p>

      <h3>3. Price the call and the put</h3>
      <span className="formula-line">Call = S × e^(−qT) × N(d1) − K × e^(−rT) × N(d2) = {$(R.call)}</span>
      <span className="formula-line">Put = K × e^(−rT) × N(−d2) − S × e^(−qT) × N(−d1) = {$(R.put)}</span>
      <p>
        Read the call formula as two pieces: the stock you expect to receive, weighted by N(d1), minus the strike you expect to pay,
        weighted by N(d2) and discounted to today. Both options are out of or near the money, so almost all of their value is time value:
        the chance the stock moves enough before expiration.
      </p>

      <h3>4. Check with put-call parity</h3>
      <p>
        A call minus a put with the same strike and date has to equal the stock minus the present value of the strike. Otherwise you could
        buy one side, sell the other and lock in a riskless profit.
      </p>
      <span className="formula-line">Call − put = S × e^(−qT) − K × e^(−rT)</span>
      <span className="formula-line">
        {$(R.call)} − {$(R.put)} = {$(R.call - R.put)}, and {$(R.discountedS)} − {$(R.discountedK)} = {$(R.discountedS - R.discountedK)}
      </span>

      <h2>Why volatility matters most</h2>
      <p>
        An option&rsquo;s downside is capped at the premium, but its upside isn&rsquo;t. More movement in either direction makes the upside
        more likely and doesn&rsquo;t make the downside worse, so higher volatility raises both calls and puts. In the example, moving
        volatility from 25% to 35% takes the call from {$(R.call)} to {$(HIGH.call)} and the put from {$(R.put)} to {$(HIGH.put)}.
      </p>
      <p>
        Valora starts with <b>historical volatility</b>: the standard deviation of the stock&rsquo;s daily returns over the past year,
        scaled to a year by multiplying by √252, the number of trading days. If you enter what an option actually trades for, Valora works
        backward to the <b>implied volatility</b>, the volatility that makes the formula match the market. Implied above historical usually
        means the market expects a big event, like earnings, before expiration.
      </p>

      <h2>The Greeks</h2>
      <p>Each Greek says how the price moves when one input changes and the others hold still. For the example call and put:</p>
      <div style={{ overflowX: "auto" }}>
        <table className="greeks compact">
          <thead>
            <tr><th>Greek</th><th>Measures</th><th className="num">Call</th><th className="num">Put</th></tr>
          </thead>
          <tbody>
            <tr><td><b>Delta</b></td><td>Change in price for a $1 rise in the stock</td><td className="num">{f4(cg.delta)}</td><td className="num">{f4(pg.delta)}</td></tr>
            <tr><td><b>Gamma</b></td><td>Change in delta for a $1 rise in the stock</td><td className="num">{f4(cg.gamma)}</td><td className="num">{f4(pg.gamma)}</td></tr>
            <tr><td><b>Vega</b></td><td>Change in price if volatility rises 1 point</td><td className="num">{f4(cg.vega)}</td><td className="num">{f4(pg.vega)}</td></tr>
            <tr><td><b>Theta</b></td><td>Change in price as one day passes</td><td className="num">{f4(cg.theta)}</td><td className="num">{f4(pg.theta)}</td></tr>
            <tr><td><b>Rho</b></td><td>Change in price if rates rise 1 point</td><td className="num">{f4(cg.rho)}</td><td className="num">{f4(pg.rho)}</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        So if the stock rises $1, the call gains about {$(cg.delta)} and the put loses about {$(-pg.delta)}. Each day that passes costs the
        call about {$(-cg.theta)}. Calls and puts share the same gamma and vega, because both gain from movement.
      </p>

      <h2>What the model assumes</h2>
      <ul>
        <li>Volatility and interest rates stay constant until expiration. In practice they don&rsquo;t, which is why traders talk about a volatility smile: implied volatility differs by strike.</li>
        <li>Stock returns follow a normal distribution, so big crashes and spikes are rarer in the model than in real markets.</li>
        <li>The option can only be exercised at expiration (a European option). US stock options are American and can be exercised early, which matters mostly for deep in-the-money puts and calls on high-dividend stocks.</li>
        <li>No trading costs, and you can trade continuously.</li>
      </ul>
      <p className="callout">
        Ready to try it? <Link href="/options">Price an option on any US-listed stock</Link> with live prices, or check the{" "}
        <Link href="/learn/glossary">glossary</Link> and <Link href="/learn/interview-questions#options">options interview questions</Link>.
      </p>
    </PageShell>
  );
}
