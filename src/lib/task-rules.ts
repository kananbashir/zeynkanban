// Which group a task belongs to on a day view, and how statuses are shown. Pure, tested in task-rules.test.ts.

export type DayTask = { dueDate: string; finished: boolean; finishedOn: string | null };
export type Section = "overdue" | "due" | "finished";

/**
 * On the day being viewed:
 * - finished tasks show on the day they were finished;
 * - unfinished tasks show on their due day;
 * - when viewing today, unfinished tasks from earlier days also show, as overdue.
 */
export function sectionFor(task: DayTask, viewDate: string, today: string): Section | null {
  if (task.finished) return (task.finishedOn ?? task.dueDate) === viewDate ? "finished" : null;
  if (task.dueDate === viewDate) return "due";
  if (viewDate === today && task.dueDate < today) return "overdue";
  return null;
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
