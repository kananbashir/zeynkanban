// When a task's reminder goes out. Pure functions, tested in reminder-rules.test.ts.
import { addDays } from "./dates";

export const REMIND_DAYS = [1, 3, 5] as const;
export const DEFAULT_REMIND_TIME = "09:00";

/** Keeps only reminders the form can make: 1, 3 or 5 days before, at a valid time of day. */
export function cleanReminder(days: unknown, time: unknown): { days: number | null; time: string | null } {
  const d = Number(days);
  if (!(REMIND_DAYS as readonly number[]).includes(d)) return { days: null, time: null };
  const t = typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_REMIND_TIME;
  return { days: d, time: t };
}

/** The day the reminder is for. */
export function reminderDate(dueDate: string, days: number): string {
  return addDays(dueDate, -days);
}

/**
 * "send" once the reminder's moment has come (also when it was set too late, as long as the task
 * isn't past its date), "wait" before it, "missed" when the due date has already passed.
 */
export function reminderState(task: { dueDate: string; remindDays: number; remindTime: string }, today: string, clock: string): "send" | "wait" | "missed" {
  if (task.dueDate < today) return "missed";
  const day = reminderDate(task.dueDate, task.remindDays);
  if (day < today) return "send";
  if (day > today) return "wait";
  return clock >= task.remindTime ? "send" : "wait";
}
