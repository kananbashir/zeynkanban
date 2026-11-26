// Content bank: titles, and finding briefs on the page. Pure, tested in bank-rules.test.ts.
import type { BriefField } from "./brief-rules";

export const BANK_TITLE_LIMIT = 120;

/** A title as typed: spaces tidied and capped. Empty means there is none. */
export function cleanBankTitle(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, BANK_TITLE_LIMIT);
}

export type BankStatus = "all" | "unused" | "used";

/** All the text of a brief, for the search box and the short preview on its card. */
export function briefText(fields: BriefField[]): string {
  return fields
    .map((f) => (typeof f.value === "string" ? f.value : f.value.map((v) => (typeof v === "string" ? v : v.name)).join(" ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The briefs a search and status filter leave: every word of the search must be in the title or the text. */
export function findBriefs<B extends { title: string; fields: BriefField[]; usedFor: string | null }>(list: B[], search: string, status: BankStatus): B[] {
  const words = search.toLocaleLowerCase("az").split(/\s+/).filter(Boolean);
  return list.filter((b) => {
    if (status === "unused" && b.usedFor) return false;
    if (status === "used" && !b.usedFor) return false;
    if (!words.length) return true;
    const text = `${b.title} ${briefText(b.fields)}`.toLocaleLowerCase("az");
    return words.every((w) => text.includes(w));
  });
}

/** The title a copy starts with: "Title (copy)", or "Title (copy 2)" when that is taken, and so on. */
export function copyTitle(title: string, taken: string[], word: string): string {
  const used = new Set(taken.map((t) => t.toLocaleLowerCase("az")));
  const base = cleanBankTitle(title).replace(new RegExp(`\\s*\\(${word}(?: \\d+)?\\)$`), "");
  for (let n = 1; ; n++) {
    const name = cleanBankTitle(`${base} (${word}${n > 1 ? ` ${n}` : ""})`);
    if (!used.has(name.toLocaleLowerCase("az"))) return name;
  }
}
