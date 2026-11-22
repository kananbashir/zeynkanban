import type { MetadataRoute } from "next";

// Lets phones add the site to the home screen; an iPhone only allows push notifications for sites added this way.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zeyn Media Projects",
    short_name: "Zeyn Media",
    start_url: "/",
    display: "standalone",
    background_color: "#edf6f4",
    theme_color: "#edf6f4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
