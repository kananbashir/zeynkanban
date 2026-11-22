// Turns a stored notification into words, in either language. Pure, tested in notification-text.test.ts.
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { dateInZone, daysBetween, weekdayIndex } from "./dates";
import { shortDate } from "./format-date";

export type TaskRef = { taskId: string; type: string; code: string; customer: string; customerId: string; due: string };

export type NotificationData =
  | ({ kind: "assigned"; by: string } & TaskRef)
  | ({ kind: "moved"; to: string | null } & TaskRef)
  | ({ kind: "changed"; dateFrom?: string; dateTo?: string; description?: boolean; note?: string | null } & TaskRef)
  | ({ kind: "review"; by: string } & TaskRef)
  | ({ kind: "overdue"; assignee: string | null } & TaskRef)
  | ({ kind: "status"; from: string; to: string; by: string } & TaskRef)
  | ({ kind: "reminder" } & TaskRef)
  | { kind: "overdueMany"; count: number }
  | { kind: "summary"; scope: "staff" | "own"; date: string; tasks: number; customers: number; overdue: number; drafts: number };

export type NotificationText = { title: string; a: string; b: string; href: string; icon: IconKind };
export type IconKind = "assigned" | "moved" | "changed" | "review" | "overdue" | "summary" | "status" | "reminder";

type T = Dictionary["notifications"];
type TaskT = Pick<Dictionary["tasks"], "monthsShort" | "tasksN" | "task1">;

export function notificationText(d: NotificationData, viewerIsStaff: boolean, today: string, t: T, taskT: TaskT): NotificationText {
  const date = (iso: string) => shortDate(iso, taskT);
  const tasks = (n: number) => (n === 1 ? taskT.task1 : fill(taskT.tasksN, { n }));
  if (d.kind === "summary") {
    const a =
      d.scope === "staff"
        ? fill(t.summaryStaff, { tasks: tasks(d.tasks), customers: d.customers === 1 ? t.customer1 : fill(t.customersN, { n: d.customers }), overdue: d.overdue })
        : fill(t.summaryOwn, { tasks: tasks(d.tasks), overdue: d.overdue });
    const b = d.scope === "staff" && d.drafts ? (d.drafts === 1 ? t.draft1 : fill(t.draftsN, { n: d.drafts })) : date(d.date);
    return { title: t.kinds.summary, a, b, href: viewerIsStaff ? "/board" : "/my-tasks", icon: "summary" };
  }
  if (d.kind === "overdueMany") return { title: fill(t.kinds.overdueMany, { n: d.count }), a: t.overdueManyLine, b: "", href: "/board", icon: "overdue" };

  const a = `${d.type} · ${d.code} · ${d.customer}`;
  const href = viewerIsStaff ? `/customers/${d.customerId}?tab=tasks&date=${d.due}&edit=${d.taskId}` : `/my-tasks?date=${d.due}`;
  const due = d.due === today ? t.dueToday : fill(t.dueOn, { date: date(d.due) });
  switch (d.kind) {
    case "assigned":
      return { title: t.kinds.assigned, a, b: `${fill(t.by, { name: d.by })} · ${due}`, href, icon: "assigned" };
    case "moved":
      return { title: t.kinds.moved, a, b: d.to ? fill(t.nowWith, { name: d.to }) : t.nowDraft, href: viewerIsStaff ? href : "/my-tasks", icon: "moved" };
    case "review":
      return { title: t.kinds.review, a, b: fill(t.markedReady, { name: d.by }), href, icon: "review" };
    case "overdue":
      return { title: t.kinds.overdue, a, b: d.assignee ? fill(t.wasDueBy, { date: date(d.due), name: d.assignee }) : fill(t.wasDue, { date: date(d.due) }), href, icon: "overdue" };
    case "status":
      return { title: t.kinds.status, a, b: `${d.from} → ${d.to} · ${d.by}`, href, icon: "status" };
    case "reminder": {
      const left = daysBetween(today, d.due);
      const b = left < 0 ? fill(t.wasDue, { date: date(d.due) }) : left === 0 ? t.remindToday : left === 1 ? t.remindTomorrow : fill(t.remindIn, { n: left, date: date(d.due) });
      return { title: t.kinds.reminder, a, b, href, icon: "reminder" };
    }
    case "changed": {
      const parts: string[] = [];
      if (d.dateFrom && d.dateTo) parts.push(fill(t.dateMoved, { from: date(d.dateFrom), to: date(d.dateTo) }));
      if (d.description) parts.push(t.descriptionChanged);
      if (d.note !== undefined) parts.push(d.note ? fill(t.noteChanged, { note: d.note }) : t.noteRemoved);
      return { title: t.kinds.changed, a, b: parts.join(" · "), href, icon: "changed" };
    }
  }
}

/** "now", "10 min", "09:00" (today), "Thu 17:20" (this week), "20 Nov" (older). Baku time. */
export function notificationTime(at: Date, now: Date, t: T, taskT: Pick<Dictionary["tasks"], "monthsShort" | "weekdaysShort">, timeZone?: string): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) return t.now;
  if (minutes < 60) return fill(t.minutes, { n: minutes });
  const day = dateInZone(at, timeZone);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone ?? "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const age = daysBetween(day, dateInZone(now, timeZone));
  if (age === 0) return clock;
  if (age < 7) return `${taskT.weekdaysShort[weekdayIndex(day)]} ${clock}`;
  return shortDate(day, taskT);
}

/** Which setting turns a kind of notification on or off. */
export const PREF_OF = {
  assigned: "assigned",
  moved: "assigned",
  changed: "changed",
  review: "review",
  overdue: "overdue",
  summary: "summary",
  status: "status",
  reminder: "reminder",
} as const;
export type PrefKey = (typeof PREF_OF)[keyof typeof PREF_OF];
export const STAFF_PREFS: PrefKey[] = ["assigned", "changed", "reminder", "summary", "review", "status", "overdue"];
export const OWN_PREFS: PrefKey[] = ["assigned", "changed", "reminder", "summary"];
