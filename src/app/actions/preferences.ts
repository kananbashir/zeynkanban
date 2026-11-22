"use server";

import { cookies } from "next/headers";
import { isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Saves the theme for this browser (the page has already switched). */
export async function saveTheme(theme: Theme) {
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
