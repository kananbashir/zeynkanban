import type { Locale } from "@/i18n/dictionaries";

/**
 * Statuses, task types and holidays have a name in Azerbaijani (the main language) and, optionally,
 * in English. English readers see the English name when there is one.
 */
export function localName(name: string, nameEn: string | null | undefined, locale: Locale): string {
  return locale === "en" && nameEn?.trim() ? nameEn : name;
}
