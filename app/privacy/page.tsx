import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Privacy | Valora" };

export default function Page() {
  return (
    <PageShell>
      <h1>Privacy</h1>
      <p className="lede">Valora collects as little as it can. You can use every model without an account.</p>

      <h2>What Valora stores</h2>
      <p>
        If you sign in with Google, Valora receives your name, email address and profile picture from Google. It uses them only to
        identify your account and show who is signed in. If you save a model, Valora stores the inputs for that model (the ticker, your
        assumptions and the name you give it) so you can open it again later.
      </p>
      <p>
        If you never sign in, Valora stores nothing about you. Models you build without an account live only in your browser and in any
        share link you choose to copy.
      </p>

      <h2>What Valora doesn&rsquo;t do</h2>
      <p>
        Valora doesn&rsquo;t sell or rent your information, doesn&rsquo;t show ads, and never posts anything on your behalf. It
        doesn&rsquo;t ask Google for access to your contacts, files, calendar or anything beyond your basic profile.
      </p>

      <h2>Services Valora uses</h2>
      <p>
        Accounts and saved models are kept in Supabase, protected so each person can only read their own saved models. Sign-in is handled
        by Google. The site is hosted on Vercel, which keeps standard server logs. Market data comes from the SEC, Twelve Data, Financial
        Modeling Prep and the Federal Reserve Bank of St. Louis (FRED). Requests to those data sources include tickers, never your
        account details.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can delete any saved model from your <Link href="/account">account page</Link>. To delete your whole account, get in touch
        through the <Link href="/contact">contact page</Link> and it will be removed along with everything saved to it.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the updated version will be posted on this page. Last updated November 13, 2026.</p>
    </PageShell>
  );
}
