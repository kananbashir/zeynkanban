// Calendar-date helpers. Dates are plain "YYYY-MM-DD" strings; "today" is taken in the team's
// time zone (Baku by default), not the server's, so a task due today is due today in Azerbaijan.

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Baku";

/** The calendar date of a moment in the team's time zone. */
export function dateInZone(moment: Date, timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
}

export function todayIso(timeZone = APP_TIME_ZONE): string {
  return dateInZone(new Date(), timeZone);
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7;
}

export function monthOf(iso: string): { year: number; month: number } {
  const [y, m] = iso.split("-").map(Number);
  return { year: y, month: m };
}

export function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Calendar cells for a month view, Monday first: whole weeks covering the month (35 or 42 days). */
export function monthGrid(year: number, month: number): { iso: string; inMonth: boolean }[] {
  const first = firstOfMonth(year, month);
  const start = addDays(first, -weekdayIndex(first));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const iso = addDays(start, i);
    return { iso, inMonth: monthOf(iso).month === month };
  });
  return cells[35].inMonth ? cells : cells.slice(0, 35);
}

export type SpecialDay = { date: string; name: string; kind: "holiday" | "event"; yearly: boolean };

/** Holidays and events on a date; yearly ones match on month and day in any year. */
export function specialDaysOn(iso: string, days: SpecialDay[]): SpecialDay[] {
  return days.filter((d) => d.date === iso || (d.yearly && d.date.slice(5) === iso.slice(5)));
}

export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}
