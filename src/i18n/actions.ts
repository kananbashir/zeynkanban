"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { LOCALES, type Locale } from "./dictionaries";

/** Switches the interface language for this browser. */
export async function setLocale(locale: Locale) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  (await cookies()).set("zk_lang", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}
