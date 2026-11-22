import "server-only";
import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentTypes, contents, customers, statuses, tasks, users } from "@/db/schema";
import { shiftPeriod, summarize, type Period, type Tally } from "./dashboard-rules";

export type DashRow = Tally & { id: string; name: string };

/** Everything the dashboard shows for a period. Only counts, no task details. */
export async function dashboardData(period: Period, today: string) {
  const before = shiftPeriod(period, -1);
  const [rows, [previous], statusRows, userRows, customerRows, typeRows] = await Promise.all([
    db
      .select({
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        customerId: tasks.customerId,
        statusId: tasks.statusId,
        contentTypeId: contents.contentTypeId,
        finished: statuses.isFinished,
      })
      .from(tasks)
      .innerJoin(statuses, eq(statuses.id, tasks.statusId))
      .innerJoin(contents, eq(contents.id, tasks.contentId))
      .where(and(eq(tasks.archived, false), gte(tasks.dueDate, period.from), lte(tasks.dueDate, period.to))),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(and(eq(tasks.archived, false), isNotNull(tasks.assigneeId), gte(tasks.dueDate, before.from), lte(tasks.dueDate, before.to))),
    db.select({ id: statuses.id, name: statuses.name, color: statuses.color, deleted: sql<boolean>`${statuses.deletedAt} is not null`.mapWith(Boolean) }).from(statuses).orderBy(asc(statuses.position), asc(statuses.createdAt)),
    db.select({ id: users.id, name: users.name, active: users.active }).from(users).orderBy(asc(users.name)),
    db.select({ id: customers.id, name: customers.name, color: customers.color, archived: customers.archived }).from(customers).orderBy(asc(customers.name)),
    db.select({ id: contentTypes.id, code: contentTypes.code, name: contentTypes.name, archived: contentTypes.archived }).from(contentTypes).orderBy(asc(contentTypes.createdAt)),
  ]);

  const s = summarize(rows, today);
  const tally = (map: Record<string, Tally>, id: string) => map[id] ?? { total: 0, finished: 0 };
  const byTotal = <T extends Tally & { name: string }>(list: T[]) => list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    total: s.total,
    finished: s.finished,
    overdue: s.overdue,
    drafts: s.drafts,
    previousTotal: previous?.n ?? 0,
    perDay: s.perDay,
    // People who can be assigned, plus anyone deactivated who still has tasks in the period.
    people: byTotal(userRows.filter((u) => u.active || s.byPerson[u.id]).map((u) => ({ id: u.id, name: u.name, ...tally(s.byPerson, u.id) }))),
    customers: byTotal(customerRows.filter((c) => !c.archived || s.byCustomer[c.id]).map((c) => ({ id: c.id, name: c.name, color: c.color, ...tally(s.byCustomer, c.id) }))),
    statuses: statusRows.filter((x) => !x.deleted || s.byStatus[x.id]).map((x) => ({ id: x.id, name: x.name, color: x.color, deleted: x.deleted, count: s.byStatus[x.id] ?? 0 })),
    contentTypes: typeRows.filter((x) => !x.archived || s.byContentType[x.id]).map((x) => ({ id: x.id, code: x.code, name: x.name, ...tally(s.byContentType, x.id) })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
