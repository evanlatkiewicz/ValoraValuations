import type { NextConfig } from "next";

const config: NextConfig = {
  // The preview image route reads its fonts from disk.
  outputFileTracingIncludes: { "/og": ["./assets/fonts/**"] },
};

export default config;
