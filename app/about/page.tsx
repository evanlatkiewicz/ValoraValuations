import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { MARKET } from "@/lib/companies";

export const metadata: Metadata = {
  title: "How Valora works | Valora",
  description: "Where Valora's data comes from, how starting assumptions are set, and how the sanity checks are scored.",
};

const pct = (x: number) => `${(x * 100).toFixed(2).replace(/0$/, "")}%`;

export default function Page() {
  return (
    <PageShell>
      <h1>How Valora works</h1>
      <p className="lede">
        Valora is a guided DCF builder for students and new grads learning valuation. This page explains where the numbers come from and
        how the model is checked, so you can trust it or challenge it.
      </p>

      <h2>Where the data comes from</h2>
      <p>
        When you load a ticker, Valora pulls the company&rsquo;s reported figures from SEC EDGAR, the SEC&rsquo;s free database of the
        structured data companies tag in their annual reports: 10-Ks for US companies, and 20-Fs or 40-Fs for foreign ones. It takes the last three fiscal years of revenue, operating income, D&amp;A and
        capex, plus the base year balance sheet: cash, marketable securities, debt, current assets, current liabilities and shares
        outstanding. Every figure taken from a filing is tagged &ldquo;From filing&rdquo; with a link to the filing itself.
      </p>
      <p>
        Companies don&rsquo;t always label the same line item the same way, and sometimes switch labels between years. Valora checks several
        standard labels for each item and uses whichever has the most recent data. When something can&rsquo;t be found, Valora tells you
        what to enter rather than guessing.
      </p>
      <p>
        Foreign companies like ASML, Arm and TSMC file a 20-F instead of a 10-K. Many of them use IFRS, the international accounting
        standards, so Valora reads those labels too. When a company reports in another currency, every amount is converted to US dollars at
        the latest exchange rate, so it lines up with the US share price. Margins and growth rates don&rsquo;t change with the conversion.
        Some US-listed foreign shares (ADRs) stand for more than one ordinary share, and Valora adjusts the share count for the common
        ones. One TSMC ADR, for example, is five shares.
      </p>
      <p>
        Banks and insurers don&rsquo;t report operating income the way other companies do, and a standard DCF doesn&rsquo;t fit them, so
        Valora explains that instead of loading them. Share prices aren&rsquo;t in SEC filings, so Valora adds the latest closing price from Twelve Data.
      </p>
      <p>
        The SEC loader is tested against Apple&rsquo;s fiscal 2026 10-K figures, checked by hand, and against data for several other large
        companies. The worked examples on the Learn pages use that same Apple model.
      </p>

      <h2>Starting assumptions</h2>
      <p>A loaded company starts with a first draft of every assumption, each tagged so you know it&rsquo;s a judgment call:</p>
      <table>
        <thead>
          <tr><th>Assumption</th><th>Starting value</th></tr>
        </thead>
        <tbody>
          <tr><td>Revenue growth</td><td>The recent average growth rate, capped between −5% and 25%, fading toward 4% by year five</td></tr>
          <tr><td>Operating margin</td><td>Held at the base year margin</td></tr>
          <tr><td>Tax rate</td><td>The base year effective rate, or 21% if the reported rate looks unusual</td></tr>
          <tr><td>D&amp;A and working capital</td><td>The base year as a percent of revenue</td></tr>
          <tr><td>Capex</td><td>The average percent of revenue over the last three years</td></tr>
          <tr><td>Risk-free rate</td><td>The latest 10-year Treasury yield, pulled from the Federal Reserve&rsquo;s FRED database and refreshed every few hours</td></tr>
          <tr><td>Equity risk premium</td><td>{pct(MARKET.equityRiskPremium)}, in line with Aswath Damodaran&rsquo;s implied US premium in 2026</td></tr>
          <tr><td>Beta</td><td>1.0, the market average, until you look up the company&rsquo;s own beta</td></tr>
          <tr><td>Terminal growth</td><td>2.5%</td></tr>
        </tbody>
      </table>
      <p>These are a place to start. The point of the tool is for you to change them and be able to explain why.</p>

      <h2>Sanity checks and the star rating</h2>
      <p>
        Valora runs about 15 checks on your inputs and results. Each one is green (looks reasonable), yellow (worth a second look) or red (likely a
        problem). Some examples:
      </p>
      <table>
        <thead>
          <tr><th>Check</th><th>Green</th><th>Yellow</th><th>Red</th></tr>
        </thead>
        <tbody>
          <tr><td>Terminal growth</td><td>0% to 3%</td><td>3% to 4%, or negative</td><td>Above 4%, or at or above WACC</td></tr>
          <tr><td>WACC</td><td>6% to 12%</td><td>4.5% to 6%, or 12% to 16%</td><td>Outside that</td></tr>
          <tr><td>Terminal value share of EV</td><td>Up to 80%</td><td>80% to 88%</td><td>Above 88%</td></tr>
          <tr><td>Implied exit multiple</td><td>5x to 20x</td><td>3x to 5x, or 20x to 30x</td><td>Outside that</td></tr>
          <tr><td>Margin expansion</td><td>Up to 5 points</td><td>5 to 12 points</td><td>More than 12 points, or above 60%</td></tr>
          <tr><td>Growth fade into terminal</td><td>Gap up to 5 points</td><td>5 to 10 points</td><td>More than 10 points</td></tr>
          <tr><td>Free cash flow</td><td>Positive every year</td><td>Negative early, positive by year 5</td><td>Still negative in year 5</td></tr>
        </tbody>
      </table>
      <p>
        The rating starts at five stars, loses half a star for each yellow and a full star for each red, and never goes below one. A gap to
        the market price is only ever a yellow: disagreeing with the market can be a real view, so Valora points you to the reverse DCF to
        see what would close the gap.
      </p>

      <h2>How the math is verified</h2>
      <p>
        The valuation engine is checked against a separate Excel model built with ordinary spreadsheet formulas. The automated tests confirm
        both produce the same enterprise value, equity value and price per share, to the decimal, across several scenarios. The Excel
        download uses live formulas too, so you can audit every cell.
      </p>

      <h2>Privacy</h2>
      <p>
        Valora has no accounts and no database. Your model stays in your browser. A share link stores the model inside the link itself, so
        nothing is saved on a server. Ticker lookups go to the SEC and nowhere else.
      </p>

      <h2>Open source</h2>
      <p>
        The full code is on <a href="https://github.com/evanlatkiewicz/dcf-builder">GitHub</a>. If you spot a wrong number or have an idea,
        open an issue there.
      </p>
    </PageShell>
  );
}
