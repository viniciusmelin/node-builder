import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS || false;
let assetPrefix = "";
let basePath = "";
let outputMode: "export" | undefined = undefined;

if (isGithubActions) {
  const repo = "node-builder";
  assetPrefix = `/${repo}/`;
  basePath = `/${repo}`;
  outputMode = "export";
}

const nextConfig: NextConfig = {
  output: outputMode,
  assetPrefix: assetPrefix,
  basePath: basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
