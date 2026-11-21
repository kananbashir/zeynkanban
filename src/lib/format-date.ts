import type { Dictionary } from "@/i18n/dictionaries";
import { monthOf, weekdayIndex } from "./dates";

type T = Pick<Dictionary["tasks"], "weekdays" | "monthsShort"> & { months: readonly string[] };

/** "Friday, 20 November 2026" */
export function longDate(iso: string, t: T): string {
  const { year, month } = monthOf(iso);
  return `${t.weekdays[weekdayIndex(iso)]}, ${Number(iso.slice(8))} ${t.months[month - 1]} ${year}`;
}

/** "20 Nov" */
export function shortDate(iso: string, t: Pick<T, "monthsShort">): string {
  return `${Number(iso.slice(8))} ${t.monthsShort[monthOf(iso).month - 1]}`;
}

/** "Fri, 20 Nov" (year added when it isn't the current one) */
export function dayLabel(iso: string, t: T & { weekdaysShort: readonly string[] }, currentYear: number): string {
  const { year } = monthOf(iso);
  return `${t.weekdays[weekdayIndex(iso)].slice(0, 3)}, ${shortDate(iso, t)}${year === currentYear ? "" : ` ${year}`}`;
}
