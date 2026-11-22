// Light, dark, or follow the device. Kept in a cookie per browser, like the language.
export const THEMES = ["light", "system", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "zk_theme";
export const DEFAULT_THEME: Theme = "system";

export const isTheme = (value: unknown): value is Theme => (THEMES as readonly unknown[]).includes(value);

/**
 * Runs in the page head before anything is drawn: with "system", marks the page dark when the device
 * is in dark mode, and follows the device if that changes while the page is open.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var t=d.getAttribute("data-theme");if(t==="dark"||(t==="system"&&m.matches))d.setAttribute("data-dark","");else d.removeAttribute("data-dark")}a();m.addEventListener("change",a)})();`;

/** Switches the page's theme at once (the choice is saved separately), fading the colours. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) root.classList.add("zk-theme-switching");
  root.setAttribute("data-theme", theme);
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) root.setAttribute("data-dark", "");
  else root.removeAttribute("data-dark");
  setTimeout(() => root.classList.remove("zk-theme-switching"), 400);
}
