import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, dictionaries, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "zk_lang";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
