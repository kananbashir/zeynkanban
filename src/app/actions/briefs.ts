"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bankBriefs, briefFields, contentBriefs, contents, customers, contentTypes, tasks, users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { cleanBrief, parseBrief, type BriefField, type BriefType } from "@/lib/brief-rules";
import { mayUseBank, ownsBankBrief, peopleOn, tellAboutBrief } from "@/lib/briefs";
import { dateInZone } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { isStaff, writesBriefs } from "@/lib/roles";

type Fail = { ok: false; error: ErrorKey; fieldId?: string };

export type BriefView = {
  contentId: string;
  code: string;
  customer: string;
  typeName: string;
  /** How many (unarchived) tasks this content ID has: the brief shows on all of them. */
  taskCount: number;
  fields: BriefField[];
  createdBy: string | null;
  createdOn: string | null;
  updatedBy: string | null;
  updatedOn: string | null;
  /**
   * May write it: with no brief yet, admins, managers and anyone on a task of the content ID (adding);
   * once written, admins, managers and whoever wrote it (editing and deleting).
   */
  canEdit: boolean;
  /** For writing: the starting fields from Settings, named in the reader's language. */
  template: { id: string; label: string; hint: string; type: BriefType; visible: boolean }[];
  /** The Content bank brief it was picked from (they stay linked), if any. */
  bank: { id: string; title: string } | null;
  /** Not linked to the bank yet: may pick one from the Content bank (it replaces what is there), and how many unused ones there are to pick from. */
  bankUnused: number | null;
};

/** One brief in the "Pick from the Content bank" list. */
export type BankPick = { id: string; title: string; by: string; on: string; fields: BriefField[]; usedFor: string | null };

/** Who may add (no brief yet) or change and delete (a brief there): see BriefView.canEdit. Graphic designers only read. */
async function mayWrite(me: { id: string; role: string }, contentId: string, createdBy: string | null, exists: boolean) {
  if (!writesBriefs(me.role)) return false;
  if (isStaff(me.role)) return true;
  return exists ? createdBy === me.id : (await peopleOn(contentId)).some((p) => p.userId === me.id);
}

/** Admins and managers may read every brief; others only those of content IDs they have a task on. */
async function mayRead(me: { id: string; role: string }, contentId: string) {
  if (isStaff(me.role)) return true;
  return (await peopleOn(contentId)).some((p) => p.userId === me.id);
}

/** The bank briefs someone could pick for a content ID of this customer (their own, or all for admins and managers). */
async function bankChoices(me: { id: string; role: string }, customerId: string) {
  if (!(await mayUseBank(me, customerId))) return null;
  return db
    .select({ id: bankBriefs.id, title: bankBriefs.title, fields: bankBriefs.fields, createdBy: bankBriefs.createdBy, createdAt: bankBriefs.createdAt, by: users.name, usedFor: contents.code })
    .from(bankBriefs)
    .innerJoin(users, eq(users.id, bankBriefs.createdBy))
    .leftJoin(contentBriefs, eq(contentBriefs.bankBriefId, bankBriefs.id))
    .leftJoin(contents, eq(contents.id, contentBriefs.contentId))
    .where(isStaff(me.role) ? eq(bankBriefs.customerId, customerId) : and(eq(bankBriefs.customerId, customerId), eq(bankBriefs.createdBy, me.id)))
    .orderBy(sql`${contentBriefs.contentId} is not null`, sql`${bankBriefs.createdAt} desc`);
}

const clock = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TIME_ZONE || "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

export async function loadBrief(contentId: string): Promise<{ ok: true; brief: BriefView } | Fail> {
  const me = await requireUser();
  if (!(await mayRead(me, contentId))) return { ok: false, error: "notAllowed" };
  const [found] = await db
    .select({ code: contents.code, customer: customers.name, customerId: contents.customerId, typeName: contentTypes.name })
    .from(contents)
    .innerJoin(customers, eq(customers.id, contents.customerId))
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .where(eq(contents.id, contentId));
  if (!found) return { ok: false, error: "notFound" };
  const { customerId, ...content } = found;
  const [row] = await db.select().from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  const nameOf = async (id: string | null) => (id ? ((await db.select({ name: users.name }).from(users).where(eq(users.id, id)))[0]?.name ?? null) : null);
  const { t } = await getDictionary();
  const when = (at: Date | null | undefined) => (at ? `${shortDate(dateInZone(at), t.tasks)}, ${clock(at)}` : null);
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.contentId, contentId), eq(tasks.archived, false)));
  const canEdit = await mayWrite(me, contentId, row?.createdBy ?? null, !!row);
  const locale = await getLocale();
  const template = canEdit
    ? (await db.select().from(briefFields).orderBy(asc(briefFields.position), asc(briefFields.createdAt))).map((f) => ({
        id: f.id,
        label: locale === "en" && f.labelEn ? f.labelEn : f.label,
        hint: locale === "en" && f.hintEn ? f.hintEn : f.hint,
        type: f.type,
        visible: f.visible,
      }))
    : [];
  const edited = row && row.updatedBy && row.updatedAt.getTime() - row.createdAt.getTime() > 1000;
  const bank = row?.bankBriefId ? ((await db.select({ id: bankBriefs.id, title: bankBriefs.title }).from(bankBriefs).where(eq(bankBriefs.id, row.bankBriefId)))[0] ?? null) : null;
  // A brief not linked to the bank (none yet, written by hand, or its bank brief was deleted) can be replaced by one from the bank.
  const choices = !row?.bankBriefId && canEdit ? await bankChoices(me, customerId) : null;
  return {
    ok: true,
    brief: {
      contentId,
      ...content,
      taskCount: n,
      fields: row ? parseBrief(row.fields) : [],
      createdBy: row ? await nameOf(row.createdBy) : null,
      createdOn: when(row?.createdAt),
      updatedBy: edited ? await nameOf(row.updatedBy) : null,
      updatedOn: edited ? when(row.updatedAt) : null,
      canEdit,
      template,
      bank,
      bankUnused: choices ? choices.filter((c) => !c.usedFor).length : null,
    },
  };
}

/** The bank briefs of a content ID's customer to pick from (used ones come last, and can't be picked). */
export async function loadBankPicks(contentId: string): Promise<{ ok: true; picks: BankPick[] } | Fail> {
  const me = await requireUser();
  const [content] = await db.select({ customerId: contents.customerId }).from(contents).where(eq(contents.id, contentId));
  if (!content) return { ok: false, error: "notFound" };
  const [current] = await db.select({ createdBy: contentBriefs.createdBy, bankBriefId: contentBriefs.bankBriefId }).from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  if (current?.bankBriefId || !(await mayWrite(me, contentId, current?.createdBy ?? null, !!current))) return { ok: false, error: "notAllowed" };
  const choices = await bankChoices(me, content.customerId);
  if (!choices) return { ok: false, error: "notAllowed" };
  const { t } = await getDictionary();
  return { ok: true, picks: choices.map((c) => ({ id: c.id, title: c.title, by: c.by, on: shortDate(dateInZone(c.createdAt), t.tasks), fields: parseBrief(c.fields), usedFor: c.usedFor })) };
}

/**
 * Adds or replaces the brief of a content ID and tells the people on its tasks (and, when an
 * employee wrote it, admins and managers too). Admins and managers may write any brief; employees
 * may add one to a content ID they have a task on, and change only one they added; graphic designers none.
 * A brief picked from the Content bank (`bankBriefId`, for a brief not linked yet) stays linked to it: saving one saves both.
 */
export async function saveBrief(contentId: string, fields: unknown, bankBriefId?: string | null): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const [content] = await db.select({ id: contents.id, customerId: contents.customerId }).from(contents).where(eq(contents.id, contentId));
  if (!content) return { ok: false, error: "notFound" };
  const [current] = await db.select({ createdBy: contentBriefs.createdBy, bankBriefId: contentBriefs.bankBriefId }).from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  if (!(await mayWrite(me, contentId, current?.createdBy ?? null, !!current))) return { ok: false, error: "notAllowed" };
  const clean = cleanBrief(fields);
  if (!clean.ok) return { ok: false, error: clean.error, fieldId: clean.fieldId };
  const json = JSON.stringify(clean.fields);

  // Picked from the bank: it must be one this person may pick, of the same customer, and not used yet.
  let link: string | null = null;
  if (!current?.bankBriefId && bankBriefId) {
    const [picked] = await db.select({ id: bankBriefs.id, customerId: bankBriefs.customerId, createdBy: bankBriefs.createdBy }).from(bankBriefs).where(eq(bankBriefs.id, String(bankBriefId)));
    if (!picked || picked.customerId !== content.customerId || !ownsBankBrief(me, picked.createdBy) || !(await mayUseBank(me, content.customerId))) return { ok: false, error: "notAllowed" };
    const [taken] = await db.select({ id: contentBriefs.contentId }).from(contentBriefs).where(eq(contentBriefs.bankBriefId, picked.id));
    if (taken) return { ok: false, error: "bankUsed" };
    link = picked.id;
  }

  try {
    await db.transaction(async (tx) => {
      if (current) await tx.update(contentBriefs).set({ fields: json, updatedBy: me.id, updatedAt: new Date(), ...(link ? { bankBriefId: link } : {}) }).where(eq(contentBriefs.contentId, contentId));
      else await tx.insert(contentBriefs).values({ contentId, fields: json, bankBriefId: link, createdBy: me.id, updatedBy: me.id });
      const linked = current?.bankBriefId ?? link;
      if (linked) await tx.update(bankBriefs).set({ fields: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(bankBriefs.id, linked));
    });
  } catch (error) {
    // Two people picked the same bank brief at once: the second one loses.
    if (link && String(error).includes("Duplicate")) return { ok: false, error: "bankUsed" };
    throw error;
  }
  await tellAboutBrief(contentId, me, current ? "updated" : "added");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Removes the brief of a content ID (admins and managers, or the employee who added it). A bank brief it came from is unused again. */
export async function deleteBrief(contentId: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const [current] = await db.select({ createdBy: contentBriefs.createdBy }).from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  if (!current) return { ok: true };
  if (!(await mayWrite(me, contentId, current.createdBy, true))) return { ok: false, error: "notAllowed" };
  await db.delete(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  revalidatePath("/", "layout");
  return { ok: true };
}
