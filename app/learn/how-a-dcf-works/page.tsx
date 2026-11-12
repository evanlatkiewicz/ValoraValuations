import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { EX } from "@/lib/example";

export const metadata: Metadata = {
  title: "How a DCF works | Valora",
  description: "A plain-English walkthrough of a discounted cash flow model, with a worked example on Apple.",
};

export default function Page() {
  return (
    <PageShell>
      <h1>How a DCF works</h1>
      <p className="lede">
        A discounted cash flow model says a business is worth the cash it will produce in the future, translated into today&rsquo;s
        dollars. Everything else is detail about how to estimate that cash and how much to discount it.
      </p>

      <h2>Why discount at all</h2>
      <p>
        A dollar you receive in five years is worth less than a dollar today. You could invest today&rsquo;s dollar and earn a return,
        and future cash is never guaranteed. Discounting shrinks each future dollar by the return investors require, so cash flows from
        different years can be added up on equal terms.
      </p>
      <span className="formula-line">Present value = future cash flow / (1 + discount rate)^years</span>

      <h2>The five steps</h2>

      <h3>1. Project free cash flow</h3>
      <p>
        Start from the most recent full year, then forecast five or so years of revenue, operating margin, taxes and reinvestment.
        The cash that&rsquo;s left after the business pays its taxes and reinvests is unlevered free cash flow. &ldquo;Unlevered&rdquo;
        means before any payments to lenders, because the model values the whole business, not just the shares.
      </p>
      <span className="formula-line">Free cash flow = EBIT × (1 − tax rate) + D&amp;A − capex − increase in working capital</span>
      <p>
        In Valora&rsquo;s Apple model, {EX.baseYear} revenue was {EX.revenue}. Free cash flow comes out to {EX.fcf1} in {EX.firstYear} and
        grows to {EX.fcf5} by year five.
      </p>

      <h3>2. Pick a discount rate</h3>
      <p>
        The discount rate is the weighted average cost of capital (WACC). It blends the return shareholders expect with the interest
        rate lenders charge, weighted by how much of each the company uses. The shareholder piece usually comes from the capital asset
        pricing model:
      </p>
      <span className="formula-line">Cost of equity = risk-free rate + beta × equity risk premium</span>
      <p>
        For Apple that&rsquo;s {EX.rf} + {EX.beta} × {EX.erp} = {EX.costOfEquity}. Apple has very little debt relative to its market value,
        so its WACC of {EX.wacc} sits close to its cost of equity.
      </p>

      <h3>3. Estimate the terminal value</h3>
      <p>
        You can&rsquo;t forecast forever, so the terminal value stands in for every year after the forecast. There are two common ways to
        estimate it:
      </p>
      <ul>
        <li>
          <strong>Perpetuity growth:</strong> assume the final year&rsquo;s cash flow grows at a slow, steady rate forever.
          <span className="formula-line">Terminal value = FCF × (1 + g) / (WACC − g)</span>
        </li>
        <li>
          <strong>Exit multiple:</strong> assume the business is sold at the end of the forecast for a multiple of EBITDA, like
          comparable companies trade at today.
        </li>
      </ul>
      <p>
        Checking one method against the other is good practice. Apple&rsquo;s {EX.g} perpetuity growth rate implies an exit multiple of{" "}
        {EX.impliedMultiple} EBITDA, which is a sensible number for a mature company.
      </p>

      <h3>4. Add it up to get enterprise value</h3>
      <p>
        Discount each year&rsquo;s free cash flow and the terminal value back to today, then add them. That total is enterprise value:
        what the whole business is worth to everyone who funds it.
      </p>
      <p>
        For Apple: {EX.sumPv} from the five forecast years plus {EX.pvTv} from the terminal value gives an enterprise value of {EX.ev}.
        The terminal value is {EX.tvShare} of the total, which is normal and also a warning: most of the answer rests on assumptions about
        the distant future.
      </p>

      <h3>5. Get to a price per share</h3>
      <p>Shareholders get what&rsquo;s left after lenders, plus any cash the company holds.</p>
      <span className="formula-line">Equity value = enterprise value − debt + cash</span>
      <p>
        Apple: {EX.ev} − {EX.debt} + {EX.cash} = {EX.equity}. Divided by {EX.shares} shares, that&rsquo;s {EX.price} per share.
      </p>

      <h2>Where DCFs go wrong</h2>
      <ul>
        <li>
          <strong>Small inputs, big swings.</strong> Raising Apple&rsquo;s WACC by one point drops the value from {EX.price} to{" "}
          {EX.waccUp}. Always look at a sensitivity table.
        </li>
        <li>
          <strong>Growth that never slows.</strong> A terminal growth rate above long-run economic growth means the company eventually
          becomes bigger than the economy.
        </li>
        <li>
          <strong>Margins that expand with no reason.</strong> Every assumption should have a story you can explain.
        </li>
        <li>
          <strong>Mixing up enterprise and equity value.</strong> Free cash flow before interest belongs to everyone, so it&rsquo;s
          discounted at WACC and gives enterprise value. Debt comes out afterward.
        </li>
      </ul>

      <h2>A DCF is a way of thinking</h2>
      <p>
        Valora&rsquo;s Apple model lands at {EX.price}, about {EX.upside} below the {EX.market} market price. That doesn&rsquo;t mean
        Apple is overvalued. It means the market is assuming something different from the model. Working backward, the price implies a
        WACC of about {EX.revWacc}, or perpetual growth of {EX.revG}. Asking which of those you believe is the real point of the exercise.
      </p>
      <p className="callout">
        <Link href="/">Build the Apple model yourself</Link>, or load any company by ticker and see how its numbers compare.
      </p>
    </PageShell>
  );
}
