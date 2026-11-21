import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server (server.js plus only the files it needs), so the hosting
  // never has to install or build anything. See scripts/package.mjs.
  output: "standalone",
  // The only images are two small logos; skipping resizing avoids an extra image library on the server.
  images: { unoptimized: true },
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
