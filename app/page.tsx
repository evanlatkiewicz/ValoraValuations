import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Home } from "@/components/Home";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "Valora: valuation tools for students";
const DESC =
  "Value companies and options from live filings and market data, one assumption at a time, with the math shown at every step.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, images: [{ url: "/og", width: 1200, height: 630 }], type: "website", siteName: "Valora" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og"] },
};

export default async function Page({ searchParams }: Props) {
  // Share links made before the toolkit pointed at the home page
  const m = (await searchParams).m;
  if (typeof m === "string") redirect(`/dcf?m=${encodeURIComponent(m)}`);
  return <Home />;
}
