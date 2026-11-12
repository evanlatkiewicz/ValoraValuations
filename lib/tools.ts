// The instruments Valora can value. Add a tool here and it shows up in the
// header switch and on the home page.
export interface Tool {
  id: "dcf" | "options" | "bonds";
  name: string; // what it values
  method: string; // how
  href: string;
  blurb: string;
  ready: boolean;
}

export const TOOLS: Tool[] = [
  {
    id: "dcf",
    name: "Companies",
    method: "Discounted cash flow",
    href: "/dcf",
    blurb: "Value a public company from its 10-K: free cash flow, discount rate and terminal value, with bull, base and bear cases.",
    ready: true,
  },
  {
    id: "options",
    name: "Options",
    method: "Black-Scholes",
    href: "/options",
    blurb: "Price a call or put from the live share price, volatility and Treasury yield, with the Greeks and implied volatility.",
    ready: false,
  },
  {
    id: "bonds",
    name: "Bonds",
    method: "Discounted coupons",
    href: "/bonds",
    blurb: "Price a bond from its coupons, find its yield to maturity, and see how duration and convexity measure rate risk.",
    ready: false,
  },
];
