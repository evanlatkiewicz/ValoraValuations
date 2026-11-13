import type { Metadata } from "next";
import { FinTool } from "@/components/fin/FinTool";

const TITLE = "Bank and insurer valuation (excess return model) | Valora";
const DESC =
  "Value banks, insurers and REITs on their equity with the excess return model: book value plus the profit earned above the cost of equity, from SEC filings and live prices.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, images: [{ url: "/og", width: 1200, height: 630 }], type: "website", siteName: "Valora" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og"] },
};

export default function Page() {
  return <FinTool />;
}
