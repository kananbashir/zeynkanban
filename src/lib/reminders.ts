import "server-only";
import { and, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { statuses, tasks } from "@/db/schema";
import { addDays, APP_TIME_ZONE, todayIso } from "./dates";
import { deliverPush, notify, taskRef } from "./notify";
import { reminderState } from "./reminder-rules";
import { found } from "./users";

let lastCheck = 0;

const clockIn = (moment: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(moment).replace(/^24/, "00");

/**
 * Sends the task reminders whose moment has come (see reminder-rules.ts). Called about once a
 * minute by the server's timer and on page visits; each reminder is claimed in the database
 * before it is sent, so it goes out once even with several server processes.
 */
export async function runReminders(now = new Date()): Promise<number> {
  if (now.getTime() - lastCheck < 50_000) return 0;
  lastCheck = now.getTime();
  const today = todayIso();
  const clock = clockIn(now);
  const waiting = await db
    .select({ id: tasks.id, assigneeId: tasks.assigneeId, dueDate: tasks.dueDate, remindDays: tasks.remindDays, remindTime: tasks.remindTime })
    .from(tasks)
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .where(
      and(
        isNotNull(tasks.remindDays),
        isNull(tasks.remindedAt),
        isNotNull(tasks.assigneeId),
        eq(tasks.archived, false),
        eq(statuses.isFinished, false),
        gte(tasks.dueDate, today),
        lte(tasks.dueDate, addDays(today, 5)),
      ),
    );
  const rows = [];
  for (const task of waiting) {
    if (reminderState({ dueDate: task.dueDate, remindDays: task.remindDays!, remindTime: task.remindTime ?? "09:00" }, today, clock) !== "send") continue;
    const claim = await db.update(tasks).set({ remindedAt: now }).where(and(eq(tasks.id, task.id), isNull(tasks.remindedAt)));
    if (!found(claim)) continue; // another process sent it
    const ref = await taskRef(task.id);
    if (ref && task.assigneeId) rows.push(...(await notify([task.assigneeId], "reminder", { kind: "reminder", ...ref }, task.id)));
  }
  await deliverPush(rows);
  return rows.length;
}
