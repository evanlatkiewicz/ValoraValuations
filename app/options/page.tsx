import type { Metadata } from "next";
import { OptionsTool } from "@/components/options/OptionsTool";
import { decodeOption } from "@/lib/optionShare";
import { optionCardQuery, summarizeOption } from "@/lib/og";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "Option pricing (Black-Scholes) | Valora";
const DESC =
  "Price a call and a put on any US-listed stock with Black-Scholes. Live share price, historical volatility and Treasury yield, with the Greeks in plain English and implied volatility.";

async function shared(props: Props) {
  const o = (await props.searchParams).o;
  return typeof o === "string" ? decodeOption(o) : null;
}

// Shared links (/options?o=...) get their own title and preview card.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const m = await shared(props);
  const card = m ? summarizeOption(m) : null;
  if (!card) {
    return {
      title: TITLE,
      description: DESC,
      openGraph: { title: TITLE, description: DESC, images: [{ url: "/og", width: 1200, height: 630 }], type: "website", siteName: "Valora" },
      twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og"] },
    };
  }
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(card.expiry + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const title = `${card.ticker} ${money(card.K)} options, ${date}: call ${money(card.call)}, put ${money(card.put)} | Valora`;
  const description = `Black-Scholes prices for ${card.name} options with a ${money(card.K)} strike expiring ${date}, with the stock at ${money(card.S)} and ${(card.sigma * 100).toFixed(1)}% volatility. Open it to see the Greeks and change any input.`;
  const image = `/og?${optionCardQuery(card)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: title }], type: "website", siteName: "Valora" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page(props: Props) {
  const m = await shared(props);
  return <OptionsTool key={m ? "shared" : "fresh"} initial={m} />;
}
