import type { MetadataRoute } from "next";

// Lets phones add the site to the home screen; an iPhone only allows push notifications for sites added this way.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zeynmedia project management tool",
    short_name: "Zeynmedia",
    start_url: "/",
    display: "standalone",
    // The dark page colour: the installed app opens dark (no mint flash), and Android's bars match it.
    // The page then sets the bar colour to the theme picked in Settings (see components/theme-color).
    background_color: "#0b1215",
    theme_color: "#0b1215",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
