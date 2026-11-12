import type { Metadata } from "next";
import { OptionsTool } from "@/components/options/OptionsTool";

const TITLE = "Option pricing (Black-Scholes) | Valora";
const DESC =
  "Price a call and a put on any US stock with Black-Scholes. Live share price, historical volatility and Treasury yield, with the Greeks in plain English and implied volatility.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, images: [{ url: "/og", width: 1200, height: 630 }], type: "website", siteName: "Valora" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og"] },
};

export default function Page() {
  return <OptionsTool />;
}
