"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runReminders } from "@/lib/reminders";
import { db } from "@/db";
import { contents, statuses, taskAssignees, taskReminders, taskTypes, tasks, users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole, requireUser } from "@/lib/auth";
import { isIsoDateString } from "@/lib/dates";
import { cleanName } from "@/lib/settings-rules";
import { countsByDay, wholeDay, type TaskView } from "@/lib/tasks";
import { deliverPush, notify, refOnly, staffIds, taskRef } from "@/lib/notify";
import { cleanReminders } from "@/lib/reminder-rules";
import { taskEnd } from "@/lib/task-rules";
import { found } from "@/lib/users";

export type Result = { ok: true; id?: string } | { ok: false; error: ErrorKey };

const sendDueReminders = () => runReminders().then(() => undefined, (error) => console.error("reminders", error));

/** Phone pushes go out after the page has answered, so saving never waits for them. */
function push(rows: Awaited<ReturnType<typeof notify>>) {
  if (rows.length) after(() => deliverPush(rows).catch((error) => console.error("push", error)));
}
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
  /** The people on the task (none: a draft). */
  assigneeIds: string[];
  /** The task's day: it shows from here. */
  dueDate: string;
  /** Optional last day (after dueDate): the unfinished task shows every day until then. Null or the same day = none. */
  deadline?: string | null;
  description: string;
  note: string;
  /** Remind the people on it these many days before the deadline (or the task's day) (any of 1, 3, 5), at remindTime ("HH:MM"). Empty = no reminder. */
  remindDays?: number[];
  remindTime?: string | null;
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
  if (input.deadline && !isIsoDateString(input.deadline)) return "dateInvalid";
  if (input.deadline && input.deadline < input.dueDate) return "deadlineBeforeDate";
  const [content] = await db.select({ customerId: contents.customerId }).from(contents).where(eq(contents.id, input.contentId));
  if (!content || content.customerId !== input.customerId) return "contentRequired";
  const people = cleanIds(input.assigneeIds);
  if (people.length) {
    const active = await db.$count(users, and(inArray(users.id, people), eq(users.active, true)));
    if (active !== people.length) return "notFound";
  }
  return null;
}

/** The chosen people, each once, in the order picked. */
const cleanIds = (ids: unknown): string[] => [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))].slice(0, 20);

/** Puts the chosen people on a task, replacing whoever was on it. */
async function saveAssignees(taskId: string, ids: string[]) {
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  if (ids.length) await db.insert(taskAssignees).values(ids.map((userId, position) => ({ taskId, userId, position })));
}

/** Who is on a task now. */
async function assigneesOf(taskId: string): Promise<string[]> {
  return (await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, taskId)).orderBy(asc(taskAssignees.position))).map((r) => r.userId);
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

/** The deadline to store: only one after the task's day (validated above); otherwise none. */
const deadlineOf = (input: TaskInput): string | null => (input.deadline && input.deadline > input.dueDate ? input.deadline : null);

/** Creates a task. It starts with the first status; with nobody on it, it is a draft. */
export async function createTask(input: TaskInput): Promise<Result> {
  const me = await requireRole("admin", "manager");
  const problem = await validate(input);
  if (problem) return fail(problem);
  const type = await resolveType(input);
  if (!type.ok) return fail(type.error);
  const [first] = await db.select({ id: statuses.id, isFinished: statuses.isFinished }).from(statuses).where(isNull(statuses.deletedAt)).orderBy(asc(statuses.position)).limit(1);
  if (!first) return fail("lastStatus");
  const id = randomUUID();
  const reminder = cleanReminders(input.remindDays, input.remindTime);
  await db.insert(tasks).values({
    id,
    customerId: input.customerId,
    contentId: input.contentId,
    taskTypeId: type.id,
    statusId: first.id,
    dueDate: input.dueDate,
    deadline: deadlineOf(input),
    description: text(input.description, 5000) || null,
    note: text(input.note, 500),
    finishedAt: first.isFinished ? new Date() : null,
    remindTime: reminder.time,
    createdBy: me.id,
  });
  if (reminder.days.length) {
    await db.insert(taskReminders).values(reminder.days.map((daysBefore) => ({ taskId: id, daysBefore })));
    after(sendDueReminders); // one already due goes out now, not at the next check
  }
  const people = cleanIds(input.assigneeIds);
  await saveAssignees(id, people);
  const others = people.filter((p) => p !== me.id);
  if (others.length) {
    const ref = await taskRef(id);
    if (ref) push(await notify(others, "assigned", { kind: "assigned", by: me.name, ...refOnly(ref) }, id));
  }
  refresh();
  return { ok: true, id };
}

export async function updateTask(id: string, input: TaskInput): Promise<Result> {
  const me = await requireRole("admin", "manager");
  const problem = await validate(input);
  if (problem) return fail(problem);
  const type = await resolveType(input);
  if (!type.ok) return fail(type.error);
  const [row] = await db
    .select({ dueDate: tasks.dueDate, deadline: tasks.deadline, description: tasks.description, note: tasks.note, remindTime: tasks.remindTime })
    .from(tasks)
    .where(eq(tasks.id, id));
  const before = row ? { ...row, assigneeIds: await assigneesOf(id) } : null;
  const reminder = cleanReminders(input.remindDays, input.remindTime);
  const result = await db
    .update(tasks)
    .set({
      contentId: input.contentId,
      taskTypeId: type.id,
      dueDate: input.dueDate,
      deadline: deadlineOf(input),
      description: text(input.description, 5000) || null,
      note: text(input.note, 500),
      remindTime: reminder.time,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.customerId, input.customerId)));
  if (!found(result)) return fail("notFound");
  await saveAssignees(id, cleanIds(input.assigneeIds));
  // Reminders count back from the deadline (or the task's day): moving it makes them all due again.
  const endBefore = before ? taskEnd(before) : null;
  await saveReminders(id, reminder.days, !before || endBefore !== taskEnd({ dueDate: input.dueDate, deadline: deadlineOf(input) }) || before.remindTime !== reminder.time);
  if (before) await notifyChanges(id, before, me);
  return refresh();
}

/**
 * Keeps the task's reminder rows in line with the form. Each reminder goes out once; reminders that
 * stay keep that record, unless the due date or the time changed, which makes them all due again.
 */
async function saveReminders(taskId: string, days: number[], timingChanged: boolean) {
  const current = (await db.select({ daysBefore: taskReminders.daysBefore }).from(taskReminders).where(eq(taskReminders.taskId, taskId))).map((r) => r.daysBefore);
  const gone = current.filter((d) => !days.includes(d));
  const added = days.filter((d) => !current.includes(d));
  if (gone.length) await db.delete(taskReminders).where(and(eq(taskReminders.taskId, taskId), inArray(taskReminders.daysBefore, gone)));
  if (added.length) await db.insert(taskReminders).values(added.map((daysBefore) => ({ taskId, daysBefore })));
  if (days.length) after(sendDueReminders); // one already due goes out now, not at the next check
  if (timingChanged) await db.update(taskReminders).set({ sentAt: null }).where(eq(taskReminders.taskId, taskId));
}

/**
 * Tells the people concerned what an edit changed for them: newly added people that the task is
 * theirs, removed people who has it now, and people who stay on it what changed. Nobody is told
 * about their own edits.
 */
async function notifyChanges(id: string, before: { assigneeIds: string[]; dueDate: string; deadline: string | null; description: string | null; note: string }, me: { id: string; name: string }) {
  const ref = await taskRef(id);
  if (!ref) return;
  const now = ref.assignees.map((p) => p.id);
  const added = now.filter((p) => !before.assigneeIds.includes(p) && p !== me.id);
  const removed = before.assigneeIds.filter((p) => !now.includes(p) && p !== me.id);
  const stayed = now.filter((p) => before.assigneeIds.includes(p) && p !== me.id);
  const facts = refOnly(ref);
  const rows = [];
  if (added.length) rows.push(...(await notify(added, "assigned", { kind: "assigned", by: me.name, ...facts }, id)));
  if (removed.length) rows.push(...(await notify(removed, "moved", { kind: "moved", to: ref.assignees.length ? ref.assignees.map((p) => p.name).join(", ") : null, ...facts }, id)));
  if (stayed.length) {
    const [current] = await db.select({ description: tasks.description, note: tasks.note }).from(tasks).where(eq(tasks.id, id));
    const change = {
      // ref.due is when it is due now (deadline or day); tell them when that moved.
      ...(taskEnd(before) !== ref.due ? { dateFrom: taskEnd(before), dateTo: ref.due } : {}),
      ...((before.description ?? "") !== (current?.description ?? "") ? { description: true } : {}),
      ...(before.note !== (current?.note ?? "") ? { note: current?.note ?? "" } : {}),
    };
    if (Object.keys(change).length) rows.push(...(await notify(stayed, "changed", { kind: "changed", ...change, ...facts }, id)));
  }
  push(rows);
}

/**
 * Admins and managers can change any task's status; employees only tasks they are on, not to a
 * status that counts as cancelled or postponed, and not while the task is cancelled or postponed.
 */
export async function setTaskStatus(id: string, statusId: string): Promise<Result> {
  const me = await requireUser();
  const [task] = await db
    .select({ wasFinished: statuses.isFinished, wasCancelled: statuses.isCancelled, wasPostponed: statuses.isPostponed, finishedAt: tasks.finishedAt, postponedAt: tasks.postponedAt, statusId: tasks.statusId, statusName: statuses.name, statusNameEn: statuses.nameEn })
    .from(tasks)
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .where(eq(tasks.id, id));
  if (!task) return fail("notFound");
  const people = await assigneesOf(id);
  if (me.role === "employee" && !people.includes(me.id)) return fail("notAllowed");
  const [status] = await db
    .select({ name: statuses.name, nameEn: statuses.nameEn, isFinished: statuses.isFinished, isCancelled: statuses.isCancelled, isPostponed: statuses.isPostponed, notifyReview: statuses.notifyReview })
    .from(statuses)
    .where(and(eq(statuses.id, statusId), isNull(statuses.deletedAt)));
  if (!status) return fail("notFound");
  // Cancelling and postponing are for admins and managers, and so is taking a task out of those statuses.
  if (me.role === "employee" && (status.isCancelled || status.isPostponed || task.wasCancelled || task.wasPostponed)) return fail("notAllowed");
  // Finished and cancelled tasks are closed: remember the day (kept when moving between closed statuses).
  const closed = status.isFinished || status.isCancelled;
  const finishedAt = closed ? ((task.wasFinished || task.wasCancelled) && task.finishedAt ? task.finishedAt : new Date()) : null;
  // Postponing remembers the day too (it shows on that day only); kept when moving between postponed statuses.
  const postponedAt = status.isPostponed ? (task.wasPostponed && task.postponedAt ? task.postponedAt : new Date()) : null;
  await db.update(tasks).set({ statusId, finishedAt, postponedAt, updatedAt: new Date() }).where(eq(tasks.id, id));
  if (task.statusId !== statusId) {
    const ref = await taskRef(id);
    if (ref) {
      // Admins and managers hear about every status change made by someone else ("Ready for review"
      // has its own notification). The people on the task are told when someone else changes its status.
      const staff = await staffIds(me.id);
      const facts = refOnly(ref);
      const change = {
        kind: "status" as const,
        from: task.statusName,
        to: status.name,
        ...(task.statusNameEn ? { fromEn: task.statusNameEn } : {}),
        ...(status.nameEn ? { toEn: status.nameEn } : {}),
        by: me.name,
        ...facts,
      };
      const rows = status.notifyReview ? await notify(staff, "review", { kind: "review", by: me.name, ...facts }, id) : await notify(staff, "status", change, id);
      const workers = people.filter((p) => p !== me.id && !staff.includes(p));
      if (workers.length) rows.push(...(await notify(workers, "changed", change, id)));
      push(rows);
    }
  }
  return refresh();
}

/** How long after a reminder with the bell the same task can be rung again. */
const NUDGE_GAP_MS = 60_000;

/**
 * The bell on a card: an admin or manager reminds the people on the task (everyone but themselves)
 * with a notification in the site and on their phones. Once a minute per task at most.
 */
export async function nudgeTask(id: string): Promise<Result> {
  const me = await requireRole("admin", "manager");
  const [task] = await db.select({ archived: tasks.archived, nudgedAt: tasks.nudgedAt }).from(tasks).where(eq(tasks.id, id));
  if (!task || task.archived) return fail("notFound");
  const people = (await assigneesOf(id)).filter((p) => p !== me.id);
  if (!people.length) return fail("notAllowed");
  const now = new Date();
  if (task.nudgedAt && now.getTime() - task.nudgedAt.getTime() < NUDGE_GAP_MS) return fail("nudgeTooSoon");
  // Claim the minute first, so two quick taps (or two people at once) send it only once.
  const since = new Date(now.getTime() - NUDGE_GAP_MS);
  const claimed = await db
    .update(tasks)
    .set({ nudgedAt: now, nudgedBy: me.id })
    .where(and(eq(tasks.id, id), or(isNull(tasks.nudgedAt), lt(tasks.nudgedAt, since))));
  if (!found(claimed)) return fail("nudgeTooSoon");
  const ref = await taskRef(id);
  if (ref) push(await notify(people, "nudge", { kind: "nudge", by: me.name, ...refOnly(ref) }, id));
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
