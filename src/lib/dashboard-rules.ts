// The dashboard's rules: which days a period covers, and how tasks are counted.
// Pure functions, tested in dashboard-rules.test.ts.
//
// Counting: every unarchived task someone is on counts once on its due date (and, in the team
// workload, once for each person on it). Drafts (nobody on them) are counted only in their own
// total, the same way the managing board leaves them out.
import { addDays, firstOfMonth, monthOf, shiftMonth, weekdayIndex } from "./dates";

export type PeriodKind = "week" | "month";
export type Period = { kind: PeriodKind; from: string; to: string; days: string[] };

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

/** The week (Monday to Sunday) or month that contains the given day. */
export function periodOf(kind: PeriodKind, iso: string): Period {
  let from: string, to: string;
  if (kind === "week") {
    from = mondayOf(iso);
    to = addDays(from, 6);
  } else {
    const { year, month } = monthOf(iso);
    from = firstOfMonth(year, month);
    const next = shiftMonth(year, month, 1);
    to = addDays(firstOfMonth(next.year, next.month), -1);
  }
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return { kind, from, to, days };
}

/** The period before (-1) or after (+1). */
export function shiftPeriod(period: Period, by: number): Period {
  if (period.kind === "week") return periodOf("week", addDays(period.from, 7 * by));
  const { year, month } = monthOf(period.from);
  const m = shiftMonth(year, month, by);
  return periodOf("month", firstOfMonth(m.year, m.month));
}

export type CountRow = {
  /** The day the task counts on: its deadline, or its own day without one. */
  dueDate: string;
  assigneeIds: string[];
  customerId: string;
  statusId: string;
  contentTypeId: string;
  finished: boolean;
  /** In a status that counts as cancelled / postponed (both: never overdue). */
  cancelled?: boolean;
  postponed?: boolean;
};

export type Tally = { total: number; finished: number };

export type Summary = {
  total: number;
  finished: number;
  overdue: number;
  drafts: number;
  cancelled: number;
  postponed: number;
  perDay: Record<string, Tally>;
  byPerson: Record<string, Tally>;
  byCustomer: Record<string, Tally>;
  byStatus: Record<string, number>;
  byContentType: Record<string, Tally>;
};

const add = (map: Record<string, Tally>, key: string, finished: boolean) => {
  const t = (map[key] ??= { total: 0, finished: 0 });
  t.total++;
  if (finished) t.finished++;
};

export function summarize(rows: CountRow[], today: string): Summary {
  const s: Summary = { total: 0, finished: 0, overdue: 0, drafts: 0, cancelled: 0, postponed: 0, perDay: {}, byPerson: {}, byCustomer: {}, byStatus: {}, byContentType: {} };
  for (const r of rows) {
    if (!r.assigneeIds.length) {
      s.drafts++;
      continue;
    }
    s.total++;
    const finished = r.finished && !r.cancelled;
    if (r.cancelled) s.cancelled++;
    else if (finished) s.finished++;
    else if (r.postponed) s.postponed++;
    else if (r.dueDate < today) s.overdue++;
    add(s.perDay, r.dueDate, finished);
    for (const person of r.assigneeIds) add(s.byPerson, person, r.finished);
    add(s.byCustomer, r.customerId, r.finished);
    add(s.byContentType, r.contentTypeId, r.finished);
    s.byStatus[r.statusId] = (s.byStatus[r.statusId] ?? 0) + 1;
  }
  return s;
}

/** A round top for the day chart's scale, so the middle line is a whole number too: 4, 6, 8, 10, then tens. */
export function chartTop(values: number[]): number {
  const max = Math.max(0, ...values);
  if (max <= 4) return 4;
  if (max <= 10) return Math.ceil(max / 2) * 2;
  return Math.ceil(max / 10) * 10;
}

/** Whole-number percentage, 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}
