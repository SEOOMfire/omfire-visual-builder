import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres", "@electric-sql/pglite", "playwright-core"],
};

export default nextConfig;
