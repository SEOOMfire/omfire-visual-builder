import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
};

export default nextConfig;
