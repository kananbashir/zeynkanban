"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contents, statuses, taskTypes, tasks, users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole, requireUser } from "@/lib/auth";
import { isIsoDateString } from "@/lib/dates";
import { cleanName } from "@/lib/settings-rules";
import { countsByDay, wholeDay, type TaskView } from "@/lib/tasks";
import { found } from "@/lib/users";

export type Result = { ok: true; id?: string } | { ok: false; error: ErrorKey };
const fail = (error: ErrorKey): Result => ({ ok: false, error });

function refresh(): Result {
  revalidatePath("/", "layout");
  return { ok: true };
}

export type TaskInput = {
  customerId: string;
  contentId: string;
  /** An existing task type, or null with typeName to use a type typed by hand. */
  taskTypeId: string | null;
  typeName?: string;
  /** Add a hand-typed type to the list in Settings. */
  saveType?: boolean;
  assigneeId: string | null;
  dueDate: string;
  description: string;
  note: string;
};

async function resolveType(input: TaskInput): Promise<{ ok: true; id: string } | { ok: false; error: ErrorKey }> {
  if (input.taskTypeId) {
    const [type] = await db.select({ id: taskTypes.id }).from(taskTypes).where(eq(taskTypes.id, input.taskTypeId));
    return type ? { ok: true, id: type.id } : { ok: false, error: "notFound" };
  }
  const name = cleanName(input.typeName);
  if (!name.ok) return { ok: false, error: "typeRequired" };
  // Reuse a listed type with the same name rather than creating a duplicate.
  const [same] = await db
    .select({ id: taskTypes.id })
    .from(taskTypes)
    .where(and(eq(taskTypes.name, name.value), isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false)));
  if (same) return { ok: true, id: same.id };
  const id = randomUUID();
  const position = input.saveType ? await db.$count(taskTypes, isNull(taskTypes.deletedAt)) : 0;
  await db.insert(taskTypes).values({ id, name: name.value, position, oneOff: !input.saveType });
  return { ok: true, id };
}

async function validate(input: TaskInput): Promise<ErrorKey | null> {
  if (!isIsoDateString(input.dueDate)) return "dateInvalid";
  const [content] = await db.select({ customerId: contents.customerId }).from(contents).where(eq(contents.id, input.contentId));
  if (!content || content.customerId !== input.customerId) return "contentRequired";
  if (input.assigneeId) {
    const active = await db.$count(users, and(eq(users.id, input.assigneeId), eq(users.active, true)));
    if (!active) return "notFound";
  }
  return null;
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

/** Creates a task. It starts with the first status; without an assignee it is a draft. */
export async function createTask(input: TaskInput): Promise<Result> {
  const me = await requireRole("admin", "manager");
  const problem = await validate(input);
  if (problem) return fail(problem);
  const type = await resolveType(input);
  if (!type.ok) return fail(type.error);
  const [first] = await db.select({ id: statuses.id, isFinished: statuses.isFinished }).from(statuses).where(isNull(statuses.deletedAt)).orderBy(asc(statuses.position)).limit(1);
  if (!first) return fail("lastStatus");
  const id = randomUUID();
  await db.insert(tasks).values({
    id,
    customerId: input.customerId,
    contentId: input.contentId,
    taskTypeId: type.id,
    statusId: first.id,
    assigneeId: input.assigneeId || null,
    dueDate: input.dueDate,
    description: text(input.description, 5000) || null,
    note: text(input.note, 500),
    finishedAt: first.isFinished ? new Date() : null,
    createdBy: me.id,
  });
  refresh();
  return { ok: true, id };
}

export async function updateTask(id: string, input: TaskInput): Promise<Result> {
  await requireRole("admin", "manager");
  const problem = await validate(input);
  if (problem) return fail(problem);
  const type = await resolveType(input);
  if (!type.ok) return fail(type.error);
  const result = await db
    .update(tasks)
    .set({
      contentId: input.contentId,
      taskTypeId: type.id,
      assigneeId: input.assigneeId || null,
      dueDate: input.dueDate,
      description: text(input.description, 5000) || null,
      note: text(input.note, 500),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.customerId, input.customerId)));
  return found(result) ? refresh() : fail("notFound");
}

/** Admins and managers can change any task's status; employees only their own. */
export async function setTaskStatus(id: string, statusId: string): Promise<Result> {
  const me = await requireUser();
  const [task] = await db
    .select({ assigneeId: tasks.assigneeId, wasFinished: statuses.isFinished, finishedAt: tasks.finishedAt })
    .from(tasks)
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .where(eq(tasks.id, id));
  if (!task) return fail("notFound");
  if (me.role === "employee" && task.assigneeId !== me.id) return fail("notAllowed");
  const [status] = await db.select({ isFinished: statuses.isFinished }).from(statuses).where(and(eq(statuses.id, statusId), isNull(statuses.deletedAt)));
  if (!status) return fail("notFound");
  const finishedAt = status.isFinished ? (task.wasFinished && task.finishedAt ? task.finishedAt : new Date()) : null;
  await db.update(tasks).set({ statusId, finishedAt, updatedAt: new Date() }).where(eq(tasks.id, id));
  return refresh();
}

export async function setTaskArchived(id: string, archived: boolean): Promise<Result> {
  await requireRole("admin");
  const result = await db.update(tasks).set({ archived: !!archived, updatedAt: new Date() }).where(eq(tasks.id, id));
  return found(result) ? refresh() : fail("notFound");
}

/* ---------- Data the task form loads as you move around its calendar ---------- */

export async function loadDay(date: string): Promise<TaskView[]> {
  await requireRole("admin", "manager");
  if (!isIsoDateString(date)) return [];
  return wholeDay(date);
}

export async function loadMonthCounts(from: string, to: string): Promise<Record<string, number>> {
  await requireRole("admin", "manager");
  if (!isIsoDateString(from) || !isIsoDateString(to)) return {};
  return countsByDay(from, to);
}
