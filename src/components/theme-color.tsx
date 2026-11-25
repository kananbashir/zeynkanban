"use client";

import { useEffect } from "react";

const LIGHT = "#c9dfd8"; // the page background (--color-sage), light
const DARK = "#0b1215"; // and dark

/**
 * Keeps the phone's system bars (and Android's gesture-bar strip, where it isn't drawn over) in the
 * page's own colour, following the theme picked in Settings, not only the phone's light or dark mode.
 */
export function ThemeColor() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const color = root.hasAttribute("data-dark") ? DARK : LIGHT;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.removeAttribute("media");
        m.content = color;
      });
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(root, { attributes: true, attributeFilter: ["data-dark"] });
    return () => watch.disconnect();
  }, []);
  return null;
}
