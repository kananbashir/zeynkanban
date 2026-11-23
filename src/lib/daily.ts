import "server-only";
import { and, asc, eq, gt, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { appValues, contents, customers, statuses, taskAssignees, taskTypes, tasks, users } from "@/db/schema";
import { taskEndColumn } from "./task-end";
import { assigneesColumn, hasAssignees, noAssignees, parseAssignees } from "./assignees";
import { addDays, APP_TIME_ZONE, todayIso } from "./dates";
import { deliverPush, notify, pruneNotifications, refOnly, staffIds, taskRef } from "./notify";
import { isUniqueViolation } from "./users";

/** Tasks that can still become late: not finished, cancelled or postponed. */
const stillOpen = and(eq(statuses.isFinished, false), eq(statuses.isCancelled, false), eq(statuses.isPostponed, false));

/** Up to this many overdue tasks are announced one by one; more become a single notification. */
const OVERDUE_ONE_BY_ONE = 3;
export const DAILY_HOUR = 9;

let doneFor: string | null = null;
let running: Promise<boolean> | null = null;

const hourIn = (moment: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", hour12: false }).format(moment)) % 24;

/**
 * The once-a-day work, from 09:00 Baku time: overdue alerts for admins and managers, the morning
 * summary for everyone, and clearing old notifications. Safe to call often: it runs once per day,
 * even with several server processes, because the day is claimed with a unique database row.
 */
export function runDailyJobs(now = new Date()): Promise<boolean> {
  const today = todayIso();
  if (doneFor === today || hourIn(now) < DAILY_HOUR) return Promise.resolve(false);
  running ??= work(today).finally(() => (running = null));
  return running;
}

async function work(today: string): Promise<boolean> {
  try {
    await db.insert(appValues).values({ key: `daily:${today}`, value: new Date().toISOString() });
  } catch (error) {
    if (isUniqueViolation(error)) {
      doneFor = today;
      return false;
    }
    throw error;
  }
  doneFor = today;
  const [last] = await db.select({ value: appValues.value }).from(appValues).where(eq(appValues.key, "daily:last"));
  const since = last && last.value < today ? (last.value > addDays(today, -14) ? last.value : addDays(today, -14)) : addDays(today, -1);
  await db.insert(appValues).values({ key: "daily:last", value: today }).onDuplicateKeyUpdate({ set: { value: today } });

  const rows = [...(await overdueAlerts(since, today)), ...(await deadlineAlerts(today)), ...(await summaries(today))];
  await deliverPush(rows);
  await pruneNotifications();
  return true;
}

/** Tasks that became overdue since the last run: deadline (or day) on or after `since`, before today, still unfinished. */
async function overdueAlerts(since: string, today: string) {
  const rows = await db
    .select({ taskId: tasks.id, type: taskTypes.name, typeEn: taskTypes.nameEn, code: contents.code, customer: customers.name, customerId: customers.id, due: taskEndColumn, assignees: assigneesColumn })
    .from(tasks)
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .innerJoin(taskTypes, eq(taskTypes.id, tasks.taskTypeId))
    .innerJoin(contents, eq(contents.id, tasks.contentId))
    .innerJoin(customers, eq(customers.id, tasks.customerId))
    .where(and(eq(tasks.archived, false), hasAssignees, stillOpen, gte(taskEndColumn, since), lt(taskEndColumn, today)))
    .orderBy(asc(taskEndColumn));
  if (!rows.length) return [];
  const staff = await staffIds();
  if (rows.length > OVERDUE_ONE_BY_ONE) return notify(staff, "overdue", { kind: "overdueMany", count: rows.length });
  const out = [];
  for (const { assignees, typeEn, ...task } of rows) {
    const names = parseAssignees(assignees).map((p) => p.name).join(", ");
    out.push(...(await notify(staff, "overdue", { kind: "overdue", ...task, ...(typeEn ? { typeEn } : {}), assignee: names || null }, task.taskId)));
  }
  return out;
}

/**
 * One day before a deadline: the people on the task and whoever created it (the assigner) hear that
 * one day is left. Only for tasks that have a deadline after their day, still unfinished.
 */
async function deadlineAlerts(today: string) {
  const rows = await db
    .select({ taskId: tasks.id, from: tasks.dueDate, createdBy: tasks.createdBy })
    .from(tasks)
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .where(and(eq(tasks.archived, false), hasAssignees, stillOpen, isNotNull(tasks.deadline), gt(tasks.deadline, tasks.dueDate), eq(tasks.deadline, addDays(today, 1))));
  const out = [];
  for (const row of rows) {
    const ref = await taskRef(row.taskId);
    if (!ref) continue;
    const people = [...ref.assignees.map((p) => p.id), ...(row.createdBy ? [row.createdBy] : [])];
    out.push(...(await notify(people, "deadline", { kind: "deadline", from: row.from, ...refOnly(ref) }, row.taskId)));
  }
  return out;
}

async function summaries(today: string) {
  const live = and(eq(tasks.archived, false), hasAssignees);
  const unfinishedLate = and(live, stillOpen, lt(taskEndColumn, today));
  const count = sql<number>`count(*)`.mapWith(Number);

  const [[dueToday], [late], [drafts], people] = await Promise.all([
    db.select({ n: count, customers: sql<number>`count(distinct ${tasks.customerId})`.mapWith(Number) }).from(tasks).where(and(live, lte(tasks.dueDate, today), gte(taskEndColumn, today))),
    db.select({ n: count }).from(tasks).innerJoin(statuses, eq(statuses.id, tasks.statusId)).where(unfinishedLate),
    db.select({ n: count }).from(tasks).where(and(eq(tasks.archived, false), noAssignees)),
    db.select({ id: users.id, role: users.role }).from(users).where(eq(users.active, true)),
  ]);
  const staff = people.filter((p) => p.role !== "employee").map((p) => p.id);
  const out = await notify(staff, "summary", { kind: "summary", scope: "staff", date: today, tasks: dueToday.n, customers: dueToday.customers, overdue: late.n, drafts: drafts.n });

  const employees = people.filter((p) => p.role === "employee").map((p) => p.id);
  if (employees.length) {
    const own = await db
      .select({
        id: taskAssignees.userId,
        today: sql<number>`sum(${tasks.dueDate} <= ${today} and ${taskEndColumn} >= ${today})`.mapWith(Number),
        late: sql<number>`sum(${taskEndColumn} < ${today} and ${statuses.isFinished} = false and ${statuses.isCancelled} = false and ${statuses.isPostponed} = false)`.mapWith(Number),
      })
      .from(taskAssignees)
      .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
      .innerJoin(statuses, eq(statuses.id, tasks.statusId))
      .where(and(eq(tasks.archived, false), inArray(taskAssignees.userId, employees)))
      .groupBy(taskAssignees.userId);
    for (const o of own) {
      if (!o.id || (!o.today && !o.late)) continue; // nothing to say
      out.push(...(await notify([o.id], "summary", { kind: "summary", scope: "own", date: today, tasks: o.today, customers: 0, overdue: o.late, drafts: 0 })));
    }
  }
  return out;
}
