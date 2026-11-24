"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { briefFields, contentBriefs, contents, customers, contentTypes, taskAssignees, tasks, users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { cleanBrief, parseBrief, type BriefField, type BriefType } from "@/lib/brief-rules";
import { dateInZone } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { deliverPush, notify, refOnly, staffIds, taskRef } from "@/lib/notify";

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
};

/** The people on the (unarchived) tasks of a content ID, each with one of their tasks, earliest first. */
async function peopleOn(contentId: string) {
  return db
    .select({ userId: taskAssignees.userId, taskId: tasks.id })
    .from(taskAssignees)
    .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
    .where(and(eq(tasks.contentId, contentId), eq(tasks.archived, false)))
    .orderBy(asc(tasks.dueDate));
}

/** Who may add (no brief yet) or change and delete (a brief there): see BriefView.canEdit. */
async function mayWrite(me: { id: string; role: string }, contentId: string, createdBy: string | null, exists: boolean) {
  if (me.role !== "employee") return true;
  return exists ? createdBy === me.id : (await peopleOn(contentId)).some((p) => p.userId === me.id);
}

/** Admins and managers may read every brief; others only those of content IDs they have a task on. */
async function mayRead(me: { id: string; role: string }, contentId: string) {
  if (me.role !== "employee") return true;
  return (await peopleOn(contentId)).some((p) => p.userId === me.id);
}

const clock = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TIME_ZONE || "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

export async function loadBrief(contentId: string): Promise<{ ok: true; brief: BriefView } | Fail> {
  const me = await requireUser();
  if (!(await mayRead(me, contentId))) return { ok: false, error: "notAllowed" };
  const [content] = await db
    .select({ code: contents.code, customer: customers.name, typeName: contentTypes.name })
    .from(contents)
    .innerJoin(customers, eq(customers.id, contents.customerId))
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .where(eq(contents.id, contentId));
  if (!content) return { ok: false, error: "notFound" };
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
    },
  };
}

/**
 * Adds or replaces the brief of a content ID and tells the people on its tasks (and, when an
 * employee wrote it, admins and managers too). Admins and managers may write any brief; employees
 * may add one to a content ID they have a task on, and change only one they added.
 */
export async function saveBrief(contentId: string, fields: unknown): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const [content] = await db.select({ id: contents.id }).from(contents).where(eq(contents.id, contentId));
  if (!content) return { ok: false, error: "notFound" };
  const [current] = await db.select({ createdBy: contentBriefs.createdBy }).from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  if (!(await mayWrite(me, contentId, current?.createdBy ?? null, !!current))) return { ok: false, error: "notAllowed" };
  const clean = cleanBrief(fields);
  if (!clean.ok) return { ok: false, error: clean.error, fieldId: clean.fieldId };
  const [existing] = await db.select({ id: contentBriefs.contentId }).from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  const json = JSON.stringify(clean.fields);
  if (existing) await db.update(contentBriefs).set({ fields: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(contentBriefs.contentId, contentId));
  else await db.insert(contentBriefs).values({ contentId, fields: json, createdBy: me.id, updatedBy: me.id });

  // One notification per person, pointing at one of their tasks with this content ID. When an
  // employee wrote it, admins and managers who aren't on a task are told too (pointing at its first task).
  const byTask = new Map<string, string[]>();
  const seen = new Set<string>();
  const people = await peopleOn(contentId);
  for (const p of people) {
    if (p.userId === me.id || seen.has(p.userId)) continue;
    seen.add(p.userId);
    byTask.set(p.taskId, [...(byTask.get(p.taskId) ?? []), p.userId]);
  }
  const first = people.find((p) => p.userId === me.id)?.taskId ?? people[0]?.taskId;
  if (me.role === "employee" && first)
    for (const id of await staffIds(me.id)) {
      if (seen.has(id)) continue;
      seen.add(id);
      byTask.set(first, [...(byTask.get(first) ?? []), id]);
    }
  const rows: Awaited<ReturnType<typeof notify>> = [];
  for (const [taskId, people] of byTask) {
    const ref = await taskRef(taskId);
    if (ref) rows.push(...(await notify(people, "brief", { kind: "brief", action: existing ? "updated" : "added", by: me.name, ...refOnly(ref) }, taskId)));
  }
  if (rows.length) after(() => deliverPush(rows));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Removes the brief of a content ID (admins and managers, or the employee who added it). */
export async function deleteBrief(contentId: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const [current] = await db.select({ createdBy: contentBriefs.createdBy }).from(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  if (!current) return { ok: true };
  if (!(await mayWrite(me, contentId, current.createdBy, true))) return { ok: false, error: "notAllowed" };
  await db.delete(contentBriefs).where(eq(contentBriefs.contentId, contentId));
  revalidatePath("/", "layout");
  return { ok: true };
}
