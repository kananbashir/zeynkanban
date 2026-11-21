import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page depends on who is logged in, so pages are rendered per request.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
