// Content bank: titles, approval, and finding briefs on the page. Pure, tested in bank-rules.test.ts.
import type { BriefField } from "./brief-rules";
import { isStaff } from "./roles";

export const BANK_TITLE_LIMIT = 120;

/** A title as typed: spaces tidied and capped. Empty means there is none. */
export function cleanBankTitle(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, BANK_TITLE_LIMIT);
}

export type BankStatus = "all" | "unused" | "used" | "mine";
export const BANK_NOTE_LIMIT = 1000;

/** What decides who may approve a bank brief. */
export type Approval = { authorId: string; authorRole: string; approvedAt: unknown | null; approvers: { userId: string; approvedAt: unknown | null }[] };

/**
 * Who may approve a brief that isn't approved yet: with approvers, each of them (once); without, its
 * author, and for an employee's brief also any admin or manager.
 */
export function mayApprove(me: { id: string; role: string }, a: Approval): boolean {
  if (a.approvedAt) return false;
  if (a.approvers.length) return a.approvers.some((x) => x.userId === me.id && !x.approvedAt);
  if (me.id === a.authorId) return true;
  return !isStaff(a.authorRole) && isStaff(me.role);
}

/** With approvers, the brief is approved once every one of them has approved it. */
export const allApproved = (approvers: { approvedAt: unknown | null }[]) => approvers.length > 0 && approvers.every((x) => x.approvedAt);

/** May change a bank brief: admins and managers, its author, and its approvers (who approve with it). */
export function mayEditBank(me: { id: string; role: string }, authorId: string, approverIds: string[]): boolean {
  return isStaff(me.role) || me.id === authorId || approverIds.includes(me.id);
}

/** May duplicate or delete it: admins and managers and its author (not approvers). */
export function mayRemoveBank(me: { id: string; role: string }, authorId: string): boolean {
  return isStaff(me.role) || me.id === authorId;
}

/** A note as typed: line breaks kept, spaces trimmed, capped. */
export function cleanBankNote(raw: unknown): string {
  return String(raw ?? "").replace(/\r\n/g, "\n").trim().slice(0, BANK_NOTE_LIMIT);
}

/** All the text of a brief, for the search box and the short preview on its card. */
export function briefText(fields: BriefField[]): string {
  return fields
    .map((f) => (typeof f.value === "string" ? f.value : f.value.map((v) => (typeof v === "string" ? v : v.name)).join(" ")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The briefs a search and status filter leave: every word of the search must be in the title or the text. */
export function findBriefs<B extends { title: string; fields: BriefField[]; usedFor: string | null; canApprove?: boolean }>(list: B[], search: string, status: BankStatus): B[] {
  const words = search.toLocaleLowerCase("az").split(/\s+/).filter(Boolean);
  return list.filter((b) => {
    if (status === "unused" && b.usedFor) return false;
    if (status === "used" && !b.usedFor) return false;
    if (status === "mine" && !b.canApprove) return false;
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
