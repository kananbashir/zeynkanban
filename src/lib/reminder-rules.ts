// When a task's reminder goes out. Pure functions, tested in reminder-rules.test.ts.
import { addDays } from "./dates";

export const REMIND_DAYS = [1, 3, 5] as const;
export const DEFAULT_REMIND_TIME = "09:00";

/** Keeps only reminders the form can make: any of 1, 3 or 5 days before, at a valid time of day. */
export function cleanReminders(days: unknown, time: unknown): { days: number[]; time: string | null } {
  const list = (Array.isArray(days) ? days : []).map(Number).filter((d) => (REMIND_DAYS as readonly number[]).includes(d));
  const unique = [...new Set(list)].sort((a, b) => a - b);
  if (!unique.length) return { days: [], time: null };
  const t = typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_REMIND_TIME;
  return { days: unique, time: t };
}

/** The day the reminder is for. */
export function reminderDate(dueDate: string, days: number): string {
  return addDays(dueDate, -days);
}

/**
 * "send" once the reminder's moment has come (also when it was set too late, as long as the task
 * isn't past its date), "wait" before it, "missed" when the due date has already passed.
 */
export function reminderState(task: { dueDate: string; daysBefore: number; remindTime: string }, today: string, clock: string): "send" | "wait" | "missed" {
  if (task.dueDate < today) return "missed";
  const day = reminderDate(task.dueDate, task.daysBefore);
  if (day < today) return "send";
  if (day > today) return "wait";
  return clock >= task.remindTime ? "send" : "wait";
}

/* ---------- Personal tasks ---------- */

/** Reminder choices for a personal task, in minutes before its time (0 = at the time). */
export const PERSONAL_REMINDERS = [0, 15, 60, 1440] as const;
export const PERSONAL_DAY_START = "09:00";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Keeps a valid optional time and the allowed reminder choices. */
export function cleanPersonalTiming(time: unknown, reminders: unknown): { time: string | null; reminders: number[] } {
  const t = typeof time === "string" && TIME.test(time) ? time : null;
  const list = (Array.isArray(reminders) ? reminders : []).map(Number).filter((m) => (PERSONAL_REMINDERS as readonly number[]).includes(m));
  return { time: t, reminders: [...new Set(list)].sort((a, b) => a - b) };
}

/** When a personal reminder is due: the task's time (or 09:00) minus the chosen minutes, as "YYYY-MM-DD HH:MM". */
export function personalMoment(dueDate: string, time: string | null, minutesBefore: number): string {
  const [y, mo, d] = dueDate.split("-").map(Number);
  const [h, mi] = (time ?? PERSONAL_DAY_START).split(":").map(Number);
  const at = new Date(Date.UTC(y, mo - 1, d, h, mi) - minutesBefore * 60_000);
  return at.toISOString().slice(0, 16).replace("T", " ");
}

/** "send" once the moment has come (and the task's own time hasn't passed by more than a day). */
export function personalState(dueDate: string, time: string | null, minutesBefore: number, now: string): "send" | "wait" | "missed" {
  if (personalMoment(dueDate, time, -24 * 60) < now) return "missed";
  return personalMoment(dueDate, time, minutesBefore) <= now ? "send" : "wait";
}
