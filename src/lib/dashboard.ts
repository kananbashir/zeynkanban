import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentTypes, contents, customers, statuses, taskTypes, tasks, users } from "@/db/schema";
import type { Locale } from "@/i18n/dictionaries";
import { assignedTo, assigneesColumn, hasAssignees, parseAssignees } from "./assignees";
import { dateInZone } from "./dates";
import { localName } from "./names";
import { taskEndColumn } from "./task-end";
import { shiftPeriod, summarize, type Period, type Tally } from "./dashboard-rules";

export type DashRow = Tally & { id: string; name: string };

/** One of the next deadlines on an employee's dashboard. */
export type ComingTask = { id: string; dueDate: string; end: string; typeName: string; typeIcon: string; code: string };

/**
 * Everything the dashboard shows for a period. Only counts, no task details. With `mine` (a person's
 * id) it counts only the tasks that person is on, and adds their next deadlines and their tasks by type.
 */
export async function dashboardData(period: Period, today: string, locale: Locale, mine?: string) {
  const before = shiftPeriod(period, -1);
  const onlyMine = mine ? assignedTo(mine) : undefined;
  const [rows, [previous], statusRows, userRows, customerRows, typeRows] = await Promise.all([
    db
      .select({
        // A task counts on the day it is due: its deadline, or its own day without one.
        dueDate: taskEndColumn,
        assignees: assigneesColumn,
        customerId: tasks.customerId,
        statusId: tasks.statusId,
        contentTypeId: contents.contentTypeId,
        finished: statuses.isFinished,
        cancelled: statuses.isCancelled,
        postponed: statuses.isPostponed,
        taskTypeId: tasks.taskTypeId,
        finishedAt: tasks.finishedAt,
      })
      .from(tasks)
      .innerJoin(statuses, eq(statuses.id, tasks.statusId))
      .innerJoin(contents, eq(contents.id, tasks.contentId))
      .where(and(eq(tasks.archived, false), gte(taskEndColumn, period.from), lte(taskEndColumn, period.to), onlyMine)),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(and(eq(tasks.archived, false), hasAssignees, gte(taskEndColumn, before.from), lte(taskEndColumn, before.to), onlyMine)),
    db.select({ id: statuses.id, name: statuses.name, nameEn: statuses.nameEn, color: statuses.color, deleted: sql<boolean>`${statuses.deletedAt} is not null`.mapWith(Boolean) }).from(statuses).orderBy(asc(statuses.position), asc(statuses.createdAt)),
    db.select({ id: users.id, name: users.name, active: users.active }).from(users).orderBy(asc(users.name)),
    db.select({ id: customers.id, name: customers.name, color: customers.color, archived: customers.archived }).from(customers).orderBy(asc(customers.name)),
    db.select({ id: contentTypes.id, code: contentTypes.code, name: contentTypes.name, archived: contentTypes.archived }).from(contentTypes).orderBy(asc(contentTypes.createdAt)),
  ]);

  const s = summarize(
    rows.map(({ assignees, ...row }) => ({ ...row, assigneeIds: parseAssignees(assignees).map((p) => p.id) })),
    today,
  );
  const tally = (map: Record<string, Tally>, id: string) => map[id] ?? { total: 0, finished: 0 };
  const byTotal = <T extends Tally & { name: string }>(list: T[]) => list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // For a person's own dashboard: finished by their deadline, tasks by type, and what comes next.
  const mineExtras = mine ? await personal(mine, rows, today, locale) : null;

  return {
    mine: mineExtras,
    total: s.total,
    finished: s.finished,
    overdue: s.overdue,
    drafts: s.drafts,
    cancelled: s.cancelled,
    postponed: s.postponed,
    previousTotal: previous?.n ?? 0,
    perDay: s.perDay,
    // People who can be assigned, plus anyone deactivated who still has tasks in the period.
    people: byTotal(userRows.filter((u) => u.active || s.byPerson[u.id]).map((u) => ({ id: u.id, name: u.name, ...tally(s.byPerson, u.id) }))),
    customers: byTotal(customerRows.filter((c) => !c.archived || s.byCustomer[c.id]).map((c) => ({ id: c.id, name: c.name, color: c.color, ...tally(s.byCustomer, c.id) }))),
    statuses: statusRows.filter((x) => !x.deleted || s.byStatus[x.id]).map((x) => ({ id: x.id, name: localName(x.name, x.nameEn, locale), color: x.color, deleted: x.deleted, count: s.byStatus[x.id] ?? 0 })),
    contentTypes: typeRows.filter((x) => !x.archived || s.byContentType[x.id]).map((x) => ({ id: x.id, code: x.code, name: x.name, ...tally(s.byContentType, x.id) })),
  };
}

async function personal(userId: string, rows: { dueDate: string; finished: boolean; cancelled: boolean; finishedAt: Date | null; taskTypeId: string }[], today: string, locale: Locale) {
  const onTime = rows.filter((r) => r.finished && !r.cancelled && r.finishedAt && dateInZone(r.finishedAt) <= r.dueDate).length;
  const [types, next] = await Promise.all([
    db.select({ id: taskTypes.id, name: taskTypes.name, nameEn: taskTypes.nameEn, icon: taskTypes.icon }).from(taskTypes),
    // Their next unfinished tasks by deadline, late ones first.
    db
      .select({ id: tasks.id, dueDate: tasks.dueDate, end: taskEndColumn, typeName: taskTypes.name, typeNameEn: taskTypes.nameEn, typeIcon: taskTypes.icon, code: contents.code })
      .from(tasks)
      .innerJoin(statuses, eq(statuses.id, tasks.statusId))
      .innerJoin(taskTypes, eq(taskTypes.id, tasks.taskTypeId))
      .innerJoin(contents, eq(contents.id, tasks.contentId))
      .where(and(eq(tasks.archived, false), assignedTo(userId), eq(statuses.isFinished, false), eq(statuses.isCancelled, false), eq(statuses.isPostponed, false)))
      .orderBy(asc(taskEndColumn), asc(tasks.dueDate))
      .limit(5),
  ]);
  const byType = new Map<string, Tally>();
  for (const r of rows) {
    const t = byType.get(r.taskTypeId) ?? { total: 0, finished: 0 };
    t.total++;
    if (r.finished && !r.cancelled) t.finished++;
    byType.set(r.taskTypeId, t);
  }
  return {
    onTime,
    byType: types
      .filter((x) => byType.has(x.id))
      .map((x) => ({ id: x.id, name: localName(x.name, x.nameEn, locale), icon: x.icon, ...byType.get(x.id)! }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    comingUp: next.map((x): ComingTask => ({ id: x.id, dueDate: x.dueDate, end: x.end, typeName: localName(x.typeName, x.typeNameEn, locale), typeIcon: x.typeIcon, code: x.code })),
    today,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
