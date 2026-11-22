// Rules for customers, contract periods and content IDs. Pure functions, tested in content-rules.test.ts.
//
// Content ID scheme (from Zeyn Media's spreadsheet):
//   [customer short name]-[content type code]-[contract months][year(s)]-[number]
//   thrive-vid-nd26-1    Thrive, video, November–December 2026, first one
//   thrive-gpost-dj2627-3  December 2026 – January 2027 (the period crosses the new year, so both years)

/** English month initials, as used in the existing IDs ("nd26" = November–December, "dj2627" = December–January). */
const MONTH_LETTERS = ["j", "f", "m", "a", "m", "j", "j", "a", "s", "o", "n", "d"];

/** Pastel card colours for customers, from the approved designs. */
export const CUSTOMER_COLORS = ["#f9d5f0", "#f8dfc4", "#c6e9f7", "#d2cbf6", "#cdeedd", "#f3ecb4"] as const;

export function nextCustomerColor(used: string[]): string {
  return CUSTOMER_COLORS.find((c) => !used.includes(c)) ?? CUSTOMER_COLORS[used.length % CUSTOMER_COLORS.length];
}

export type Month = { year: number; month: number }; // month 1–12

/** "2026-11-01" or "2026-11" -> { year: 2026, month: 11 } */
export function parseMonth(value: string): Month | null {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function monthToDate({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function addMonths({ year, month }: Month, count: number): Month {
  const index = year * 12 + (month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Number of months in a contract, counting both ends: November–December = 2. */
export function monthSpan(start: Month, end: Month): number {
  return end.year * 12 + end.month - (start.year * 12 + start.month) + 1;
}

export const MAX_CONTRACT_MONTHS = 24;

export function contractProblem(start: Month | null, end: Month | null): "periodInvalid" | "periodTooLong" | null {
  if (!start || !end) return "periodInvalid";
  const span = monthSpan(start, end);
  if (span < 1) return "periodInvalid";
  if (span > MAX_CONTRACT_MONTHS) return "periodTooLong";
  return null;
}

/** The period part of a content ID: n26, nd26, dj2627. */
export function periodCode(start: Month, end: Month): string {
  const letters = start.year === end.year && start.month === end.month ? MONTH_LETTERS[start.month - 1] : MONTH_LETTERS[start.month - 1] + MONTH_LETTERS[end.month - 1];
  const yy = (y: number) => String(y % 100).padStart(2, "0");
  return letters + (start.year === end.year ? yy(start.year) : yy(start.year) + yy(end.year));
}

/** The default renewal: starts the month after the current contract ends and lasts as long. */
export function defaultRenewal(start: Month, end: Month): { start: Month; end: Month } {
  const nextStart = addMonths(end, 1);
  return { start: nextStart, end: addMonths(nextStart, monthSpan(start, end) - 1) };
}

/** Customer short names start content IDs, so: lowercase letters and digits, starting with a letter, 2–20 characters. */
export function cleanShortName(input: unknown): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9]{1,19}$/.test(value) ? value : null;
}

/** A content ID typed or overwritten by hand: lowercase letters, digits and single hyphens, 3–60 characters. */
export function cleanContentId(input: unknown): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  return value.length >= 3 && value.length <= 60 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? value : null;
}

/** The next free content ID for a customer, type and period: thrive-vid-nd26-4 if 1–3 exist. */
export function suggestContentId(shortName: string, typeCode: string, period: string, existing: string[]): string {
  const prefix = `${shortName}-${typeCode}-${period}-`;
  let highest = 0;
  for (const code of existing) {
    if (!code.startsWith(prefix)) continue;
    const number = Number(code.slice(prefix.length));
    if (Number.isInteger(number) && number > highest) highest = number;
  }
  return prefix + (highest + 1);
}

/** Several new IDs in a row, continuing from the existing ones. */
export function suggestContentIds(shortName: string, typeCode: string, period: string, existing: string[], count: number): string[] {
  const out: string[] = [];
  const taken = [...existing];
  for (let i = 0; i < count; i++) {
    const next = suggestContentId(shortName, typeCode, period, taken);
    out.push(next);
    taken.push(next);
  }
  return out;
}

/** "November – December 2026", "December 2026 – January 2027", "November 2026" in the given month names. */
/** Orders content IDs the way people count: thrive-vid-nd26-2 before thrive-vid-nd26-10. */
export function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function formatPeriod(start: Month, end: Month, monthNames: readonly string[]): string {
  const name = (m: Month) => monthNames[m.month - 1];
  if (start.year === end.year && start.month === end.month) return `${name(start)} ${start.year}`;
  if (start.year === end.year) return `${name(start)} – ${name(end)} ${start.year}`;
  return `${name(start)} ${start.year} – ${name(end)} ${end.year}`;
}
