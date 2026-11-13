import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { EX } from "@/lib/example";
import { blackScholes } from "@/lib/options";

const BS = blackScholes({ S: 100, K: 105, T: 0.5, r: 0.045, q: 0, sigma: 0.25 });
const $ = (n: number) => `$${n.toFixed(2)}`;

export const metadata: Metadata = {
  title: "Common valuation interview questions | Valora",
  description: "The DCF and options questions that come up in investment banking, sales and trading and valuation interviews, answered with real numbers.",
};

export default function Page() {
  const QA: [string, React.ReactNode][] = [
    [
      "Walk me through a DCF.",
      <>
        <p>
          A DCF values a company based on the present value of its future cash flows. First, project unlevered free cash flow for about
          five years, starting from revenue and working down through operating income, taxes, D&amp;A, capex and working capital. Second,
          discount those cash flows back at the WACC. Third, estimate a terminal value for everything after the forecast, using either a
          perpetuity growth rate or an exit multiple, and discount it back too. Adding those gives enterprise value. Subtract debt and add
          cash to get equity value, then divide by diluted shares for a value per share.
        </p>
        <p>Keep it under a minute. Interviewers mostly want to hear the steps in the right order.</p>
      </>,
    ],
    [
      "Why do you use unlevered free cash flow and not net income?",
      <p>
        Net income is after interest, so it only belongs to shareholders, and it includes non-cash items like depreciation. Unlevered free
        cash flow is the actual cash the business produces before paying lenders, so it belongs to all capital providers. That&rsquo;s why
        it&rsquo;s discounted at the WACC, which reflects both debt and equity, and why the result is enterprise value.
      </p>,
    ],
    [
      "How do you calculate WACC?",
      <>
        <p>
          WACC = (equity weight × cost of equity) + (debt weight × cost of debt × (1 − tax rate)). The weights use market values, not book
          values. The cost of equity usually comes from CAPM: risk-free rate + beta × equity risk premium.
        </p>
        <p>
          In Valora&rsquo;s Apple model, the cost of equity is {EX.rf} + {EX.beta} × {EX.erp} = {EX.costOfEquity}, and the WACC is{" "}
          {EX.wacc}. Apple&rsquo;s debt is tiny compared with its market cap, so WACC lands close to the cost of equity.
        </p>
      </>,
    ],
    [
      "Why is the cost of debt multiplied by (1 − tax rate)?",
      <p>
        Interest is tax-deductible, so every dollar of interest lowers the company&rsquo;s tax bill. The after-tax cost is what borrowing
        really costs.
      </p>,
    ],
    [
      "What happens to the valuation if WACC goes up by 1%?",
      <p>
        Value goes down, because future cash flows are discounted more heavily. In Valora&rsquo;s Apple model, raising WACC from {EX.wacc} by
        one point drops the value per share from {EX.price} to {EX.waccUp}. Lowering it a point raises the value to {EX.waccDown}. The effect
        is large because it hits the terminal value hardest.
      </p>,
    ],
    [
      "Perpetuity growth or exit multiple: which do you use?",
      <p>
        Both, ideally, as a check on each other. Perpetuity growth is more theoretical and doesn&rsquo;t depend on where the market is today.
        The exit multiple is closer to how deals are actually priced but imports today&rsquo;s market mood into the long run. Calculate the
        exit multiple your growth rate implies (Apple&rsquo;s {EX.g} works out to {EX.impliedMultiple} EBITDA) and ask whether it makes sense.
      </p>,
    ],
    [
      "Why is the terminal value such a large part of the value?",
      <p>
        It captures every year after the forecast, which is most of a healthy company&rsquo;s life. For Apple it&rsquo;s {EX.tvShare} of
        enterprise value, which is typical. This is also the main weakness of a DCF: the answer depends heavily on long-term assumptions,
        so test them with a sensitivity table.
      </p>,
    ],
    [
      "What's a reasonable terminal growth rate?",
      <p>
        Usually 2% to 3%, roughly long-run inflation plus a little real growth. It shouldn&rsquo;t exceed long-run GDP growth, because no
        company can grow faster than the economy forever. For Apple, moving it half a point from {EX.g} changes the value from{" "}
        {EX.gDown} to {EX.gUp}.
      </p>,
    ],
    [
      "How do you get from enterprise value to equity value?",
      <p>
        Subtract debt and add cash. For Apple: {EX.ev} − {EX.debt} + {EX.cash} = {EX.equity}. In a fuller model you&rsquo;d also subtract
        preferred stock and non-controlling interests, and some analysts treat leases as debt.
      </p>,
    ],
    [
      "If depreciation goes up by $10, what happens to free cash flow?",
      <p>
        It goes up by $10 × the tax rate. EBIT falls by $10, so taxes fall by $10 × tax rate and NOPAT falls by $10 × (1 − tax rate). You then
        add the full $10 back because depreciation isn&rsquo;t a cash cost. The net effect is the tax saving. At Apple&rsquo;s {EX.tax} rate,
        that&rsquo;s +${EX.taxShield}.
      </p>,
    ],
    [
      "Why use the mid-year convention?",
      <p>
        Companies earn cash throughout the year, not on the last day, so discounting each year&rsquo;s cash as if it arrives mid-year is
        more accurate. It slightly raises the value. In Valora&rsquo;s Apple model it moves the value from {EX.price} to {EX.midYear}.
      </p>,
    ],
    [
      "When wouldn't you use a DCF?",
      <p>
        When cash flows are hard to forecast or don&rsquo;t mean what they usually do. Banks and insurers are the classic case: debt is part
        of their business, not just financing, so they&rsquo;re valued with dividend models or price to book. Early-stage companies with
        years of losses are another, since almost all the value sits in the terminal value.
      </p>,
    ],
    [
      "What is a reverse DCF?",
      <p>
        You start from today&rsquo;s share price and solve for what the market must be assuming. Valora&rsquo;s Apple model comes out to{" "}
        {EX.price}, but Apple traded at {EX.market}. To get there, the market would need a WACC of about {EX.revWacc}, or perpetual growth
        of about {EX.revG}. That turns &ldquo;is the stock cheap?&rdquo; into a better question: &ldquo;do I believe what the price
        implies?&rdquo;
      </p>,
    ],
  ];

  const OQA: [string, React.ReactNode][] = [
    [
      "What's the difference between a call and a put?",
      <p>
        A call is the right to buy a stock at the strike price before expiration; a put is the right to sell at the strike. A call buyer
        profits if the stock rises above the strike plus the premium paid. A put buyer profits if it falls below the strike minus the
        premium. Neither has to exercise, so the most a buyer can lose is the premium.
      </p>,
    ],
    [
      "What are the inputs to Black-Scholes?",
      <p>
        Six: the share price, the strike, time to expiration, the risk-free rate, the dividend yield and volatility. Everything but
        volatility can be looked up, so when people disagree about an option&rsquo;s price, they&rsquo;re really disagreeing about
        volatility.
      </p>,
    ],
    [
      "What happens to a call and a put when volatility rises?",
      <p>
        Both go up. A buyer&rsquo;s loss is capped at the premium, but the gain isn&rsquo;t, so more movement in either direction only
        helps. In Valora&rsquo;s example (a {$(100)} stock, {$(105)} strike, six months, 25% volatility), the call is worth {$(BS.call)} and
        the put {$(BS.put)}. Vega is {BS.callGreeks.vega.toFixed(2)} for both, so one more point of volatility adds about{" "}
        {$(BS.callGreeks.vega)} to each.
      </p>,
    ],
    [
      "What is delta, and what does a delta of 0.5 mean?",
      <p>
        Delta is how much the option&rsquo;s price changes for a $1 move in the stock. A delta of 0.5 means the option moves about 50 cents
        per dollar, so one contract behaves like holding 50 shares. Calls have delta between 0 and 1, puts between −1 and 0. An
        at-the-money option has a delta near 0.5 (or −0.5), and it moves toward 1 or 0 as the option goes deeper in or out of the money.
        Delta is also a rough estimate of the chance the option finishes in the money.
      </p>,
    ],
    [
      "Explain theta. Why do options lose value over time?",
      <p>
        Theta is the change in an option&rsquo;s price as one day passes. Most of an option&rsquo;s value before expiration is time value:
        the chance the stock moves in your favor. With less time left, that chance shrinks, so the option loses value even if the stock
        doesn&rsquo;t move. The decay speeds up close to expiration, especially for at-the-money options.
      </p>,
    ],
    [
      "What is put-call parity?",
      <p>
        For a call and a put with the same strike and expiration, call − put = stock price − present value of the strike (adjusted for
        dividends). If it didn&rsquo;t hold, you could buy the cheap side, sell the expensive side and lock in a riskless profit. It also
        means that once you know the call price, the put price follows.
      </p>,
    ],
    [
      "What's the difference between implied and historical volatility?",
      <p>
        Historical volatility measures how much the stock actually moved, usually the standard deviation of daily returns over the past
        year, annualized by multiplying by √252. Implied volatility is the volatility that makes Black-Scholes match an option&rsquo;s
        market price, so it&rsquo;s what the market expects going forward. Implied is often higher than historical before earnings or
        other known events.
      </p>,
    ],
    [
      "What are the main limitations of Black-Scholes?",
      <p>
        It assumes volatility and rates stay constant, returns are normally distributed and the option is only exercised at expiration.
        In reality volatility changes and differs by strike (the volatility smile), big moves happen more often than a normal distribution
        allows, and US options can be exercised early. Traders still use it, mostly as a common language for quoting prices in terms of
        implied volatility.
      </p>,
    ],
  ];

  return (
    <PageShell>
      <h1>Common valuation interview questions</h1>
      <p className="lede">
        The questions that come up in investment banking, sales and trading and valuation interviews. Where it helps, the answers use
        Valora&rsquo;s own examples so you can see the numbers in context.
      </p>
      <h2 id="dcf">Discounted cash flow</h2>
      {QA.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <div>{a}</div>
        </details>
      ))}
      <h2 id="options">Options and Black-Scholes</h2>
      {OQA.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <div>{a}</div>
        </details>
      ))}
    </PageShell>
  );
}
