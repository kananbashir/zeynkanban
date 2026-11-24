import "server-only";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { personalReminders, personalTasks, statuses, taskReminders, tasks } from "@/db/schema";
import { addDays, APP_TIME_ZONE, todayIso } from "./dates";
import { taskEndColumn } from "./task-end";
import { hasAssignees } from "./assignees";
import { deliverPush, notify, refOnly, taskRef } from "./notify";
import { personalState, reminderState } from "./reminder-rules";
import { found } from "./users";

let lastCheck = 0;

const clockIn = (moment: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(moment).replace(/^24/, "00");

/**
 * Sends the task reminders whose moment has come (see reminder-rules.ts). Called every 15 seconds
 * by the server's timer, right after reminders are saved, and on page visits (at most every 10
 * seconds from those, so busy pages don't check over and over: `fromPageVisit`). Each reminder is claimed in the database before
 * it is sent, so it goes out once even with several server processes. If several of a task's
 * reminders are due at once (e.g. the 5- and 3-day ones of a task created late), one notification
 * covers them.
 */
export async function runReminders({ now = new Date(), fromPageVisit = false }: { now?: Date; fromPageVisit?: boolean } = {}): Promise<number> {
  if (fromPageVisit && now.getTime() - lastCheck < 10_000) return 0;
  lastCheck = now.getTime();
  const today = todayIso();
  const clock = clockIn(now);
  const waiting = await db
    .select({ taskId: tasks.id, dueDate: taskEndColumn, remindTime: tasks.remindTime, daysBefore: taskReminders.daysBefore }) // counted back from the deadline (or the task's day)
    .from(taskReminders)
    .innerJoin(tasks, eq(tasks.id, taskReminders.taskId))
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .where(
      and(
        isNull(taskReminders.sentAt),
        hasAssignees,
        eq(tasks.archived, false),
        eq(statuses.isFinished, false),
        eq(statuses.isCancelled, false), // no reminders for cancelled or postponed tasks
        eq(statuses.isPostponed, false),
        gte(taskEndColumn, today),
        lte(taskEndColumn, addDays(today, 5)),
      ),
    );
  const due = new Map<string, { days: number[] }>();
  for (const r of waiting) {
    if (reminderState({ dueDate: r.dueDate, daysBefore: r.daysBefore, remindTime: r.remindTime ?? "09:00" }, today, clock) !== "send") continue;
    const entry = due.get(r.taskId) ?? { days: [] };
    entry.days.push(r.daysBefore);
    due.set(r.taskId, entry);
  }
  const rows = [];
  for (const [taskId, { days }] of due) {
    const claim = await db
      .update(taskReminders)
      .set({ sentAt: now })
      .where(and(eq(taskReminders.taskId, taskId), inArray(taskReminders.daysBefore, days), isNull(taskReminders.sentAt)));
    if (!found(claim)) continue; // another process sent it
    const ref = await taskRef(taskId);
    // Everyone on the task is reminded.
    if (ref?.assignees.length) rows.push(...(await notify(ref.assignees.map((p) => p.id), "reminder", { kind: "reminder", ...refOnly(ref) }, taskId)));
  }
  rows.push(...(await personalDue(today, clock, now)));
  await deliverPush(rows);
  return rows.length;
}

/** Reminders of personal tasks; they go only to the task's owner. */
async function personalDue(today: string, clock: string, now: Date) {
  const waiting = await db
    .select({ id: personalTasks.id, ownerId: personalTasks.ownerId, title: personalTasks.title, dueDate: personalTasks.dueDate, time: personalTasks.time, minutesBefore: personalReminders.minutesBefore })
    .from(personalReminders)
    .innerJoin(personalTasks, eq(personalTasks.id, personalReminders.personalTaskId))
    .where(and(isNull(personalReminders.sentAt), eq(personalTasks.done, false), gte(personalTasks.dueDate, addDays(today, -1)), lte(personalTasks.dueDate, addDays(today, 1))));
  const nowKey = `${today} ${clock}`;
  const due = new Map<string, { row: (typeof waiting)[number]; minutes: number[] }>();
  for (const r of waiting) {
    if (personalState(r.dueDate, r.time, r.minutesBefore, nowKey) !== "send") continue;
    const entry = due.get(r.id) ?? { row: r, minutes: [] };
    entry.minutes.push(r.minutesBefore);
    due.set(r.id, entry);
  }
  const rows = [];
  for (const [id, { row, minutes }] of due) {
    const claim = await db
      .update(personalReminders)
      .set({ sentAt: now })
      .where(and(eq(personalReminders.personalTaskId, id), inArray(personalReminders.minutesBefore, minutes), isNull(personalReminders.sentAt)));
    if (!found(claim)) continue;
    rows.push(...(await notify([row.ownerId], "personal", { kind: "personal", title: row.title, due: row.dueDate, time: row.time })));
  }
  return rows;
}
