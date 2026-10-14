import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@stablesave/core",
    "@stablesave/risk-engine",
    "@stablesave/protocol-adapters",
    "@stablesave/client",
    "@stablesave/ui",
  ],
  poweredByHeader: false,
  // The share-card route reads its fonts from disk.
  outputFileTracingIncludes: { "/api/og": ["./assets/fonts/**/*"] },
  // Don't let `next dev` write agent rule files into the app folder.
  agentRules: false,
};

export default nextConfig;
