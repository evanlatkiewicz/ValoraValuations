import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Disclaimer | Valora" };

export default function Page() {
  return (
    <PageShell>
      <h1>Disclaimer</h1>
      <p className="lede">Valora is an educational tool for learning how discounted cash flow models work.</p>

      <h2>Not investment advice</h2>
      <p>
        Nothing on this site is investment, financial, legal or tax advice, and nothing here is a recommendation to buy, sell or hold any
        security. A value per share from Valora reflects the assumptions entered into the model, not a prediction of where a stock will
        trade. Talk to a licensed professional before making investment decisions.
      </p>

      <h2>Data accuracy</h2>
      <p>
        Company figures come from structured data that companies file with the SEC. That data can be incomplete, tagged inconsistently, or
        restated later, and Valora&rsquo;s automatic mapping may not capture every company correctly. Market inputs such as the risk-free
        rate and equity risk premium are set periodically and may be out of date. Check every figure against the original filings before
        relying on it.
      </p>

      <h2>No affiliation</h2>
      <p>
        Valora is an independent student project. It isn&rsquo;t affiliated with, endorsed by, or connected to the SEC or any company shown
        in it. Company names and tickers are used only to identify public filings.
      </p>

      <h2>No warranty</h2>
      <p>
        Valora is provided as is, without any warranty. The author isn&rsquo;t responsible for decisions made using it or for errors in the
        data or calculations.
      </p>
    </PageShell>
  );
}
