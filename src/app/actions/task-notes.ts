"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { taskAssignees, taskNotes, tasks, users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { dateInZone, todayIso } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { canUseNotes, cleanNote, MAX_NOTES } from "@/lib/note-rules";
import { deliverPush, notify, refOnly, staffIds, taskRef } from "@/lib/notify";
import { found } from "@/lib/users";

export type TaskNote = { id: string; author: string; authorId: string; body: string; when: string; mine: boolean; canDelete: boolean };
type Fail = { ok: false; error: ErrorKey };

async function taskFor(taskId: string) {
  const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
  if (!task) return null;
  const assigneeIds = (await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, taskId))).map((r) => r.userId);
  return { ...task, assigneeIds };
}

const clock = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TIME_ZONE || "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

export async function loadTaskNotes(taskId: string): Promise<{ ok: true; notes: TaskNote[] } | Fail> {
  const me = await requireUser();
  const task = await taskFor(taskId);
  if (!task || !canUseNotes(me, task.assigneeIds)) return { ok: false, error: "notAllowed" };
  const { t } = await getDictionary();
  const today = todayIso();
  const rows = await db
    .select({ id: taskNotes.id, body: taskNotes.body, createdAt: taskNotes.createdAt, authorId: taskNotes.userId, author: users.name })
    .from(taskNotes)
    .innerJoin(users, eq(users.id, taskNotes.userId))
    .where(eq(taskNotes.taskId, taskId))
    .orderBy(asc(taskNotes.createdAt));
  return {
    ok: true,
    notes: rows.map((r) => {
      const day = dateInZone(r.createdAt);
      return {
        id: r.id,
        author: r.author,
        authorId: r.authorId,
        body: r.body,
        when: day === today ? clock(r.createdAt) : `${shortDate(day, t.tasks)}, ${clock(r.createdAt)}`,
        mine: r.authorId === me.id,
        canDelete: r.authorId === me.id || me.role === "admin",
      };
    }),
  };
}

/** Adds a note (at most 10 per task) and tells the people on the task and the admins and managers. */
export async function addTaskNote(taskId: string, body: string): Promise<{ ok: true; note: TaskNote } | Fail> {
  const me = await requireUser();
  const text = cleanNote(body);
  if (!text) return { ok: false, error: "noteEmpty" };
  const task = await taskFor(taskId);
  if (!task || !canUseNotes(me, task.assigneeIds)) return { ok: false, error: "notAllowed" };
  const noteId = randomUUID();
  const added = await db.transaction(async (tx) => {
    // Lock the task row so two notes sent at the same moment can't pass the limit together.
    await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).for("update");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(taskNotes).where(eq(taskNotes.taskId, taskId));
    if (n >= MAX_NOTES) return false;
    await tx.insert(taskNotes).values({ id: noteId, taskId, userId: me.id, body: text });
    return true;
  });
  if (!added) return { ok: false, error: "noteLimit" };
  const note: TaskNote = { id: noteId, author: me.name, authorId: me.id, body: text, when: clock(new Date()), mine: true, canDelete: true };
  const ref = await taskRef(taskId);
  if (ref) {
    const people = [...(await staffIds(me.id)), ...task.assigneeIds.filter((p) => p !== me.id)];
    const rows = await notify(people, "note", { kind: "note", by: me.name, body: text.length > 140 ? `${text.slice(0, 139)}…` : text, ...refOnly(ref) }, taskId);
    if (rows.length) after(() => deliverPush(rows).catch((error) => console.error("push", error)));
  }
  revalidatePath("/", "layout");
  return { ok: true, note };
}

/** The author can delete their own note; an admin can delete any. */
export async function deleteTaskNote(id: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const where = me.role === "admin" ? eq(taskNotes.id, id) : and(eq(taskNotes.id, id), eq(taskNotes.userId, me.id));
  const result = await db.delete(taskNotes).where(where);
  if (!found(result)) return { ok: false, error: "notFound" };
  revalidatePath("/", "layout");
  return { ok: true };
}
