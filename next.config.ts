import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run package` builds a self-contained server (server.js plus only the files it needs).
  // A normal `npm run build` produces the regular output, started with `npm start`.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
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
