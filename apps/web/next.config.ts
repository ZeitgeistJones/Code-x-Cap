import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@codexcap/core",
    "@codexcap/db",
    "@codexcap/connectors",
    "@codexcap/scoring",
    "@codexcap/ui",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
