import type { Metadata } from "next";
import { FinTool } from "@/components/fin/FinTool";
import { decodeFin } from "@/lib/finShare";
import { finCardQuery, summarizeFin } from "@/lib/og";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "Bank and insurer valuation (excess return model) | Valora";
const DESC =
  "Value banks, insurers and REITs on their equity with the excess return model: book value plus the profit earned above the cost of equity, from SEC filings and live prices.";

async function shared(props: Props) {
  const f = (await props.searchParams).f;
  return typeof f === "string" ? decodeFin(f) : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const m = await shared(props);
  const card = m ? summarizeFin(m) : null;
  if (!card) {
    return {
      title: TITLE,
      description: DESC,
      openGraph: { title: TITLE, description: DESC, images: [{ url: "/og", width: 1200, height: 630 }], type: "website", siteName: "Valora" },
      twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og"] },
    };
  }
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const upside = card.value / card.price - 1;
  const title = `${card.name} (${card.ticker}): ${money(card.value)} per share | Valora`;
  const description = `An excess return model of ${card.name} on Valora: ${money(card.value)} per share, ${(card.value / card.bookPerShare).toFixed(2)}x book value and ${Math.abs(upside * 100).toFixed(0)}% ${upside < 0 ? "below" : "above"} the ${money(card.price)} market price. Open it and change any assumption.`;
  const image = `/og?${finCardQuery(card)}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: title }], type: "website", siteName: "Valora" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page(props: Props) {
  const m = await shared(props);
  return <FinTool key={m ? "shared" : "fresh"} initial={m} />;
}
