import type { Metadata } from "next";
import Valora from "@/components/Valora";
import { decodeAny } from "@/lib/share";
import { cardQuery, summarize } from "@/lib/og";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DEFAULT_TITLE = "Company valuation (DCF) | Valora";
const DEFAULT_DESC =
  "Value any US-listed company from its 10-K or 20-F with a guided discounted cash flow model. Live prices, bull, base and bear cases, and sanity checks on every assumption.";

// Shared links (/?m=...) get their own title and preview card.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const m = (await searchParams).m;
  const token = typeof m === "string" ? m : null;
  const inputs = token ? await decodeAny(token) : null;
  const card = inputs ? summarize(inputs) : null;

  if (!card) {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      openGraph: { title: DEFAULT_TITLE, description: DEFAULT_DESC, images: [{ url: "/og", width: 1200, height: 630 }], type: "website", siteName: "Valora" },
      twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: DEFAULT_DESC, images: ["/og"] },
    };
  }

  const who = card.ticker ? `${card.name} (${card.ticker})` : card.name;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const upside = card.value / card.price - 1;
  const title = `${who}: ${money(card.value)} per share | Valora DCF`;
  const description = card.warn
    ? `A DCF of ${card.name} on Valora. Cash flow is still negative in year 5, so the value isn't meaningful yet. Open the model and change the assumptions.`
    : `A DCF of ${card.name} on Valora: ${money(card.value)} per share, ${Math.abs(upside * 100).toFixed(0)}% ${upside < 0 ? "below" : "above"} the ${money(card.price)} market price. Model quality ${card.stars} of 5 stars. Open it and change any assumption.`;
  const image = `/og?${cardQuery(card)}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: title }], type: "website", siteName: "Valora" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function Page() {
  return <Valora />;
}
