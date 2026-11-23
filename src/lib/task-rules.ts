// Which group a task belongs to on a day view, and how statuses are shown. Pure, tested in task-rules.test.ts.

export type DayTask = { dueDate: string; deadline?: string | null; finished: boolean; finishedOn: string | null };
export type Section = "overdue" | "due" | "finished";

/** The day a task must be finished by: its deadline, or its own day when it has none. */
export function taskEnd(task: { dueDate: string; deadline?: string | null }): string {
  return task.deadline && task.deadline > task.dueDate ? task.deadline : task.dueDate;
}

/** A personal task shows on its own day; on today's view, unfinished ones from earlier days show too. */
export function personalShownOn(task: { dueDate: string; done: boolean }, viewDate: string, today: string): boolean {
  return task.dueDate === viewDate || (viewDate === today && task.dueDate < today && !task.done);
}

/**
 * On the day being viewed:
 * - finished tasks show on the day they were finished;
 * - unfinished tasks show on every day from their day to their deadline (just their day without one);
 * - when viewing today, unfinished tasks whose deadline has passed also show, as overdue.
 */
export function sectionFor(task: DayTask, viewDate: string, today: string): Section | null {
  const end = taskEnd(task);
  if (task.finished) return (task.finishedOn ?? end) === viewDate ? "finished" : null;
  if (task.dueDate <= viewDate && viewDate <= end) return "due";
  if (viewDate === today && end < today) return "overdue";
  return null;
}

/** How many tasks fall on each day from `from` to `to`; a task with a deadline counts on every day it spans. */
export function countPerDay(tasks: { dueDate: string; deadline?: string | null }[], from: string, to: string, addDays: (iso: string, n: number) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const task of tasks) {
    const end = taskEnd(task);
    for (let d = task.dueDate < from ? from : task.dueDate; d <= end && d <= to; d = addDays(d, 1)) out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

/** Pale card backgrounds that match each status colour (finished tasks always use the neutral one). */
const CARD_BACKGROUNDS: Record<string, string> = {
  "#b04fb8": "#e9d6f5",
  "#2a7de1": "#c6e9f7",
  "#c47a00": "#f8dfc4",
  "#0c9b8d": "#cdeee6",
  "#d6456b": "#f9d5e0",
  "#7a8f1e": "#e6edc4",
};
export const FINISHED_BACKGROUND = "#f0f5f3";
export const ARCHIVED_BACKGROUND = "#e9edf0";

export function cardBackground(statusColor: string, finished: boolean): string {
  return finished ? FINISHED_BACKGROUND : (CARD_BACKGROUNDS[statusColor.toLowerCase()] ?? "#e9edf0");
}

/**
 * Tasks grouped by the people on them, for the "whole day" lists: a shared task appears under each
 * of its people; tasks nobody is on come last, under id "". Busiest people first.
 */
export function groupByPerson<T extends { assignees: { id: string; name: string }[] }>(tasks: T[]): { id: string; name: string; list: T[] }[] {
  const groups = new Map<string, { id: string; name: string; list: T[] }>();
  for (const task of tasks) {
    for (const person of task.assignees.length ? task.assignees : [{ id: "", name: "" }]) {
      const group = groups.get(person.id) ?? { id: person.id, name: person.name, list: [] };
      group.list.push(task);
      groups.set(person.id, group);
    }
  }
  return [...groups.values()].sort((a, b) => (a.id === "" ? 1 : b.id === "" ? -1 : b.list.length - a.list.length || a.name.localeCompare(b.name)));
}

export type DeadlineState =
  | { kind: "upcoming"; n: number; progress: 0 }
  | { kind: "running"; n: number; progress: number }
  | { kind: "lastDay"; n: 0; progress: 1 }
  | { kind: "late"; n: number; progress: 1 }
  | { kind: "done"; how: "early" | "onTime" | "late" | "unknown"; n: number; progress: 1 };

/**
 * Where a task with a deadline stands today, for the card's timeline strip: not started yet, n days
 * left (and how much of the time has passed), the last day, n days late, or finished (early, on time
 * or late, by the day it was finished).
 */
export function deadlineState(task: { dueDate: string; deadline: string; finished: boolean; finishedOn: string | null }, today: string, daysBetween: (a: string, b: string) => number): DeadlineState {
  const start = task.dueDate, end = task.deadline;
  if (task.finished) {
    if (!task.finishedOn) return { kind: "done", how: "unknown", n: 0, progress: 1 };
    const d = daysBetween(task.finishedOn, end);
    return { kind: "done", how: d > 0 ? "early" : d < 0 ? "late" : "onTime", n: Math.abs(d), progress: 1 };
  }
  if (today < start) return { kind: "upcoming", n: daysBetween(today, start), progress: 0 };
  if (today === end) return { kind: "lastDay", n: 0, progress: 1 };
  if (today > end) return { kind: "late", n: daysBetween(end, today), progress: 1 };
  return { kind: "running", n: daysBetween(today, end), progress: daysBetween(start, today) / daysBetween(start, end) };
}
