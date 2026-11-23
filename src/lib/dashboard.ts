import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentTypes, contents, customers, statuses, tasks, users } from "@/db/schema";
import type { Locale } from "@/i18n/dictionaries";
import { assigneesColumn, hasAssignees, parseAssignees } from "./assignees";
import { localName } from "./names";
import { taskEndColumn } from "./task-end";
import { shiftPeriod, summarize, type Period, type Tally } from "./dashboard-rules";

export type DashRow = Tally & { id: string; name: string };

/** Everything the dashboard shows for a period. Only counts, no task details. */
export async function dashboardData(period: Period, today: string, locale: Locale) {
  const before = shiftPeriod(period, -1);
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
      })
      .from(tasks)
      .innerJoin(statuses, eq(statuses.id, tasks.statusId))
      .innerJoin(contents, eq(contents.id, tasks.contentId))
      .where(and(eq(tasks.archived, false), gte(taskEndColumn, period.from), lte(taskEndColumn, period.to))),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(and(eq(tasks.archived, false), hasAssignees, gte(taskEndColumn, before.from), lte(taskEndColumn, before.to))),
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

  return {
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

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
