"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { contents, contentTypes, customers, finishedWorks, taskAssignees, tasks, users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import type { BriefLink } from "@/lib/brief-rules";
import { dateInZone } from "@/lib/dates";
import { cleanFinishedLinks, finishedRights, parseFinished } from "@/lib/finished-rules";
import { shortDate } from "@/lib/format-date";
import { deliverPush, notify, refOnly, staffIds, taskRef } from "@/lib/notify";

type Fail = { ok: false; error: ErrorKey; index?: number };

export type FinishedView = {
  contentId: string;
  code: string;
  customer: string;
  typeName: string;
  /** How many (unarchived) tasks this content ID has: the finished work shows on all of them. */
  taskCount: number;
  links: BriefLink[];
  createdBy: string | null;
  createdOn: string | null;
  updatedBy: string | null;
  updatedOn: string | null;
  canAdd: boolean;
  canEdit: boolean;
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

async function rightsFor(me: { id: string; role: string }, contentId: string) {
  const people = await peopleOn(contentId);
  const [row] = await db.select().from(finishedWorks).where(eq(finishedWorks.contentId, contentId));
  return { people, row, rights: finishedRights(me, people.some((p) => p.userId === me.id), row?.createdBy ?? null, !!row) };
}

const clock = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TIME_ZONE || "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

export async function loadFinished(contentId: string): Promise<{ ok: true; finished: FinishedView } | Fail> {
  const me = await requireUser();
  const { row, rights } = await rightsFor(me, contentId);
  if (!rights.read) return { ok: false, error: "notAllowed" };
  const [content] = await db
    .select({ code: contents.code, customer: customers.name, typeName: contentTypes.name })
    .from(contents)
    .innerJoin(customers, eq(customers.id, contents.customerId))
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .where(eq(contents.id, contentId));
  if (!content) return { ok: false, error: "notFound" };
  const nameOf = async (id: string | null) => (id ? ((await db.select({ name: users.name }).from(users).where(eq(users.id, id)))[0]?.name ?? null) : null);
  const { t } = await getDictionary();
  const when = (at: Date | null | undefined) => (at ? `${shortDate(dateInZone(at), t.tasks)}, ${clock(at)}` : null);
  const count = await db.$count(tasks, and(eq(tasks.contentId, contentId), eq(tasks.archived, false)));
  const edited = row && row.updatedBy && row.updatedAt.getTime() - row.createdAt.getTime() > 1000;
  return {
    ok: true,
    finished: {
      contentId,
      ...content,
      taskCount: count,
      links: row ? parseFinished(row.links) : [],
      createdBy: row ? await nameOf(row.createdBy) : null,
      createdOn: when(row?.createdAt),
      updatedBy: edited ? await nameOf(row.updatedBy) : null,
      updatedOn: edited ? when(row.updatedAt) : null,
      canAdd: rights.add,
      canEdit: rights.edit,
    },
  };
}

/**
 * Adds or replaces the finished work of a content ID, and tells admins and managers and the people
 * on its other tasks. `fromTask`: the task it was added from (where staff not on any task are sent).
 */
export async function saveFinished(contentId: string, links: unknown, fromTask?: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const { people, row, rights } = await rightsFor(me, contentId);
  if (row ? !rights.edit : !rights.add) return { ok: false, error: "notAllowed" };
  const clean = cleanFinishedLinks(links);
  if (!clean.ok) return { ok: false, error: clean.error, index: clean.index };
  const json = JSON.stringify(clean.links);
  if (row) await db.update(finishedWorks).set({ links: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(finishedWorks.contentId, contentId));
  else await db.insert(finishedWorks).values({ contentId, links: json, createdBy: me.id, updatedBy: me.id });

  // One notification per person: those on a task of this content ID point at one of theirs; admins
  // and managers who aren't point at the task it was added from (or the content ID's first task).
  const myTasks = people.filter((p) => p.userId === me.id).map((p) => p.taskId);
  const fromHere = fromTask ? (await db.$count(tasks, and(eq(tasks.id, fromTask), eq(tasks.contentId, contentId)))) > 0 : false;
  const fallback = fromHere ? fromTask : (people[0]?.taskId ?? (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.contentId, contentId)).limit(1))[0]?.id);
  const byTask = new Map<string, string[]>();
  const seen = new Set<string>([me.id]);
  for (const p of people) {
    if (seen.has(p.userId) || myTasks.includes(p.taskId)) continue; // not the actor, nor others on the actor's own task
    seen.add(p.userId);
    byTask.set(p.taskId, [...(byTask.get(p.taskId) ?? []), p.userId]);
  }
  if (fallback)
    for (const id of await staffIds(me.id)) {
      if (seen.has(id)) continue;
      seen.add(id);
      byTask.set(fallback, [...(byTask.get(fallback) ?? []), id]);
    }
  const rows: Awaited<ReturnType<typeof notify>> = [];
  for (const [taskId, who] of byTask) {
    const ref = await taskRef(taskId);
    if (ref) rows.push(...(await notify(who, "finished", { kind: "finished", action: row ? "updated" : "added", by: me.name, links: clean.links.length, ...refOnly(ref) }, taskId)));
  }
  if (rows.length) after(() => deliverPush(rows));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Removes the finished work of a content ID (admins, managers, or whoever added it). */
export async function deleteFinished(contentId: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const { row, rights } = await rightsFor(me, contentId);
  if (!row) return { ok: true };
  if (!rights.edit) return { ok: false, error: "notAllowed" };
  await db.delete(finishedWorks).where(eq(finishedWorks.contentId, contentId));
  revalidatePath("/", "layout");
  return { ok: true };
}
