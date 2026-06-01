import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // TypeScript checking runs separately via `npm run typecheck`
    ignoreBuildErrors: false,
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
