import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Glossary | Valora",
  description: "Plain-English definitions of the terms used in discounted cash flow models and option pricing.",
};

const RAW: [string, string][] = [
  ["10-K and 10-Q", "The annual (10-K) and quarterly (10-Q) reports US public companies file with the SEC. The financial statements in them are where a DCF's historical numbers come from."],
  ["20-F and 40-F", "The annual reports foreign companies listed in the US file with the SEC instead of a 10-K. Canadian companies file a 40-F. Many use IFRS, the international accounting standards, and report in their home currency."],
  ["ADR (American depositary receipt)", "A US-listed share that stands for shares of a foreign company held by a bank. One ADR can represent several ordinary shares: one TSMC ADR is five Taiwan-listed shares. Valora counts shares in ADRs so the value per share lines up with the US price."],
  ["Base year", "The most recent full fiscal year of actual results. Every projection in the model grows out of it."],
  ["Beta", "How much a stock tends to move when the overall market moves. A beta of 1.0 moves with the market; 1.5 moves about 50% more. Used to estimate the cost of equity."],
  ["Capital expenditures (capex)", "Cash spent on long-term assets like buildings, equipment and data centers. Found on the cash flow statement, usually as \"payments for acquisition of property, plant and equipment.\""],
  ["CAPM", "The capital asset pricing model. It estimates the return shareholders expect: risk-free rate + beta × equity risk premium."],
  ["Cost of debt", "The interest rate a company would pay to borrow today. Because interest is tax-deductible, the model uses the after-tax version: cost of debt × (1 − tax rate)."],
  ["Cost of equity", "The return shareholders expect for owning the stock. Usually estimated with CAPM. It's higher than the cost of debt because shareholders get paid last."],
  ["D&A (depreciation and amortization)", "An accounting expense that spreads the cost of long-term assets over their useful life. It reduces profit but doesn't use cash, so it's added back when calculating free cash flow."],
  ["Discount factor", "What one dollar received in a future year is worth today: 1 / (1 + WACC)^years. Multiply a future cash flow by it to get its present value."],
  ["Discount rate", "The annual return used to convert future cash into today's dollars. In a DCF of the whole business, it's the WACC."],
  ["EBIT", "Earnings before interest and taxes, also called operating income. Revenue minus the costs of running the business."],
  ["EBITDA", "EBIT plus depreciation and amortization. A rough measure of operating cash generation, often used for valuation multiples."],
  ["Enterprise value", "The value of the whole business to everyone who funds it, lenders and shareholders together. A DCF of unlevered free cash flow produces enterprise value."],
  ["Equity risk premium", "The extra annual return investors demand for owning stocks instead of risk-free government bonds. Typically estimated at around 4% to 6% for the US market."],
  ["Equity value", "What the business is worth to shareholders: enterprise value minus debt plus cash. Divide by shares outstanding to get value per share."],
  ["Exit multiple method", "A way to estimate terminal value by assuming the business is sold at the end of the forecast for a multiple of its EBITDA, based on what comparable companies trade at."],
  ["Football field", "A chart of horizontal bars comparing value ranges from different methods (scenarios, sensitivity, trading range) against today's price. A standard summary page in banking pitches."],
  ["Free cash flow (unlevered)", "Cash the business generates after taxes and reinvestment, before any payments to lenders: EBIT × (1 − tax rate) + D&A − capex − increase in working capital."],
  ["Implied exit multiple", "The EBITDA multiple that a perpetuity growth terminal value works out to. A useful check that the growth rate gives a sensible answer."],
  ["Market capitalization", "Share price × shares outstanding. The market's value of the equity."],
  ["Mid-year convention", "Assumes each year's cash arrives in the middle of the year instead of the last day, which is closer to reality. It slightly raises the value."],
  ["Net working capital", "Operating current assets (receivables, inventory) minus operating current liabilities (payables, accrued expenses). When it grows, cash is tied up in the business."],
  ["NOPAT", "Net operating profit after tax: EBIT × (1 − tax rate). What the business would earn if it had no debt."],
  ["Perpetuity growth method", "A way to estimate terminal value by assuming the final year's free cash flow grows at a steady rate forever: FCF × (1 + g) / (WACC − g)."],
  ["Probability-weighted value", "Each scenario's value times the chance you give it, added up. With 25% bear, 50% base and 25% bull, it's 0.25 × bear + 0.5 × base + 0.25 × bull."],
  ["Present value", "What a future amount of money is worth today, after discounting it."],
  ["Reverse DCF", "Working backward from today's share price to find what an assumption, like WACC or growth, would have to be for the model to match the market."],
  ["Risk-free rate", "The return on an investment with essentially no default risk. In practice, the 10-year US Treasury yield."],
  ["Scenario analysis", "Valuing the company under a few complete stories, usually bear, base and bull, instead of one. Each story changes the assumptions that drive the business together."],
  ["Sensitivity analysis", "A table showing how the valuation changes as key assumptions change, usually WACC against terminal growth or exit multiple."],
  ["Shares outstanding", "The number of shares owned by investors. Found on the cover page of the 10-K and on the balance sheet."],
  ["Standard deviation (of outcomes)", "How spread out your scenario values are around the weighted value. A bigger spread means more uncertainty about what the company is worth."],
  ["Terminal growth rate", "The rate free cash flow grows forever after the forecast. It should be at or below long-run economic growth, usually 2% to 3%."],
  ["Terminal value", "The value of all cash flows beyond the forecast period, measured at the end of the forecast. Often 60% to 80% of enterprise value."],
  ["American and European options", "A European option can only be exercised at expiration; an American option can be exercised any time before. US stock options are American. Black-Scholes prices European options, which is close enough for most contracts."],
  ["At the money", "An option whose strike is at or near today's share price."],
  ["Black-Scholes model", "The formula for pricing an option from six inputs: share price, strike, time to expiration, risk-free rate, dividend yield and volatility. Published in 1973 by Fischer Black, Myron Scholes and Robert Merton."],
  ["Breakeven (options)", "The share price at expiration where a buyer neither makes nor loses money: the strike plus the premium for a call, or the strike minus the premium for a put."],
  ["Call option", "The right, but not the obligation, to buy 100 shares at the strike price before expiration. Gains when the stock rises."],
  ["Continuous compounding", "Interest that compounds constantly instead of once or twice a year. Black-Scholes uses it, so a quoted Treasury yield y becomes 2 × ln(1 + y / 2)."],
  ["d1 and d2", "The two intermediate numbers in Black-Scholes. N(d2) is the risk-neutral chance a call finishes in the money; N(d1) is the call's delta."],
  ["Delta", "How much an option's price changes for a $1 move in the stock. Between 0 and 1 for calls, 0 and −1 for puts."],
  ["Dividend yield", "Annual dividends per share divided by the share price. Dividends go to shareholders, not option holders, so a higher yield lowers call values and raises put values."],
  ["Expiration date", "The last day an option can be exercised. Monthly US stock options expire on the third Friday of the month."],
  ["Gamma", "How much an option's delta changes for a $1 move in the stock. Highest for at-the-money options close to expiration."],
  ["Greeks", "Measures of how an option's price responds to each input: delta, gamma, vega, theta and rho."],
  ["Historical volatility", "How much a stock actually moved: the standard deviation of its daily returns, usually over the past year, multiplied by √252 to put it in annual terms."],
  ["Implied volatility", "The volatility that makes Black-Scholes match an option's market price. It's the market's forecast of how much the stock will move."],
  ["In the money", "A call whose strike is below the share price, or a put whose strike is above it. It has intrinsic value."],
  ["Intrinsic value", "What an option would be worth if exercised right now: share price minus strike for a call, strike minus share price for a put, or zero."],
  ["Option contract", "One listed stock option covers 100 shares. Prices are quoted per share, so a $2.50 quote costs $250."],
  ["Out of the money", "A call whose strike is above the share price, or a put whose strike is below it. All of its value is time value."],
  ["Premium", "The price paid for an option. The most a buyer can lose."],
  ["Put option", "The right, but not the obligation, to sell 100 shares at the strike price before expiration. Gains when the stock falls."],
  ["Put-call parity", "Call minus put, at the same strike and date, equals the share price minus the present value of the strike. If it didn't hold, there would be a riskless profit."],
  ["Rho", "How much an option's price changes if interest rates rise one percentage point. Positive for calls, negative for puts."],
  ["Strike price", "The price at which an option lets you buy (call) or sell (put) the stock."],
  ["Theta", "How much an option's price changes as one day passes, all else equal. Usually negative: options lose value over time."],
  ["Time value", "The part of an option's price above its intrinsic value. It's the value of the chance the stock moves in your favor before expiration."],
  ["Vega", "How much an option's price changes if volatility rises one percentage point. The same for a call and a put with the same strike and date."],
  ["Volatility", "How much a stock's price tends to move, measured as the annual standard deviation of its returns. The most important input to an option's price."],
  ["WACC", "Weighted average cost of capital. The blended return required by shareholders and lenders, weighted by the market value of each. The discount rate in a DCF."],
];

const TERMS = [...RAW].sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function Page() {
  const letters = [...new Set(TERMS.map(([t]) => (/[a-z]/i.test(t[0]) ? t[0].toUpperCase() : "#")))];
  return (
    <PageShell>
      <h1>Glossary</h1>
      <p className="lede">The terms you&rsquo;ll see in Valora and in valuation interviews, for company valuation and options, each in a sentence or two.</p>
      <nav className="az" aria-label="Jump to letter">
        {letters.map((l) => {
          const first = TERMS.find(([t]) => (/[a-z]/i.test(t[0]) ? t[0].toUpperCase() : "#") === l)!;
          return <a key={l} href={`#${slug(first[0])}`}>{l}</a>;
        })}
      </nav>
      <dl>
        {TERMS.map(([term, def]) => (
          <div key={term}>
            <dt id={slug(term)}>{term}</dt>
            <dd>{def}</dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
