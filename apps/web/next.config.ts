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
  // Don't let `next dev` write agent rule files into the app folder.
  agentRules: false,
};

export default nextConfig;
