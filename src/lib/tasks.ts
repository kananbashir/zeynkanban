import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "@/db";
import { contentTypes, contents, customers, specialDays, statuses, taskTypes, tasks, users } from "@/db/schema";
import { addDays, dateInZone, type SpecialDay } from "./dates";
import { sectionFor, type Section } from "./task-rules";

/** Everything a task card needs. Sent to the browser, so no secrets. */
export type TaskView = {
  id: string;
  customerId: string;
  customerName: string;
  customerColor: string;
  contentId: string;
  contentCode: string;
  contentArchived: boolean;
  contentTypeCode: string;
  taskTypeId: string;
  typeName: string;
  typeDeleted: boolean;
  isPublishing: boolean;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusDeleted: boolean;
  finished: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string;
  description: string;
  note: string;
  archived: boolean;
  finishedOn: string | null;
  remindDays: number | null;
  remindTime: string | null;
};

const assignee = alias(users, "assignee");

function select(where: SQL | undefined) {
  return db
    .select({
      id: tasks.id,
      customerId: tasks.customerId,
      customerName: customers.name,
      customerColor: customers.color,
      contentId: tasks.contentId,
      contentCode: contents.code,
      contentArchived: contents.archived,
      contentTypeCode: contentTypes.code,
      taskTypeId: tasks.taskTypeId,
      typeName: taskTypes.name,
      typeDeletedAt: taskTypes.deletedAt,
      isPublishing: taskTypes.isPublishing,
      statusId: tasks.statusId,
      statusName: statuses.name,
      statusColor: statuses.color,
      statusDeletedAt: statuses.deletedAt,
      finished: statuses.isFinished,
      assigneeId: tasks.assigneeId,
      assigneeName: assignee.name,
      dueDate: tasks.dueDate,
      description: tasks.description,
      note: tasks.note,
      archived: tasks.archived,
      finishedAt: tasks.finishedAt,
      remindDays: tasks.remindDays,
      remindTime: tasks.remindTime,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(customers, eq(customers.id, tasks.customerId))
    .innerJoin(contents, eq(contents.id, tasks.contentId))
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .innerJoin(taskTypes, eq(taskTypes.id, tasks.taskTypeId))
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .where(where)
    .orderBy(asc(tasks.dueDate), asc(customers.name), asc(tasks.createdAt));
}

type Row = Awaited<ReturnType<typeof select>>[number];

function toView(row: Row): TaskView {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    customerColor: row.customerColor,
    contentId: row.contentId,
    contentCode: row.contentCode,
    contentArchived: row.contentArchived,
    contentTypeCode: row.contentTypeCode,
    taskTypeId: row.taskTypeId,
    typeName: row.typeName,
    typeDeleted: !!row.typeDeletedAt,
    isPublishing: row.isPublishing,
    statusId: row.statusId,
    statusName: row.statusName,
    statusColor: row.statusColor,
    statusDeleted: !!row.statusDeletedAt,
    finished: row.finished,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    dueDate: row.dueDate,
    description: row.description ?? "",
    note: row.note,
    archived: row.archived,
    finishedOn: row.finishedAt ? dateInZone(row.finishedAt) : null,
    remindDays: row.remindDays,
    remindTime: row.remindTime,
  };
}

export type DayTasks = Record<Section, TaskView[]>;

/**
 * The tasks shown on a day view: overdue (today only), due that day, and finished that day.
 * Drafts (no assignee) are left out unless asked for. Optional filters narrow it to one customer or person.
 */
export async function dayTasks(date: string, today: string, filter: { customerId?: string; assigneeId?: string; includeDrafts?: boolean } = {}): Promise<DayTasks> {
  const conditions: SQL[] = [eq(tasks.archived, false)];
  if (filter.customerId) conditions.push(eq(tasks.customerId, filter.customerId));
  if (filter.assigneeId) conditions.push(eq(tasks.assigneeId, filter.assigneeId));
  if (!filter.includeDrafts) conditions.push(sql`${tasks.assigneeId} is not null`);
  // Candidates: due that day, unfinished earlier ones (when viewing today), or finished around that day.
  const around = or(
    eq(tasks.dueDate, date),
    date === today ? lt(tasks.dueDate, today) : undefined,
    and(gte(tasks.finishedAt, new Date(`${addDays(date, -1)}T00:00:00Z`)), lt(tasks.finishedAt, new Date(`${addDays(date, 2)}T00:00:00Z`))),
  );
  const rows = (await select(and(...conditions, around))).map(toView);
  const out: DayTasks = { overdue: [], due: [], finished: [] };
  for (const task of rows) {
    const section = sectionFor(task, date, today);
    if (section) out[section].push(task);
  }
  return out;
}

/** Drafts of a customer: tasks without an assignee, in date order. */
export async function draftsOf(customerId: string): Promise<TaskView[]> {
  return (await select(and(eq(tasks.customerId, customerId), eq(tasks.archived, false), isNull(tasks.assigneeId)))).map(toView);
}

/** Every task of a customer (archived ones too), for the Contents tab. */
export async function tasksOfCustomer(customerId: string): Promise<TaskView[]> {
  return (await select(eq(tasks.customerId, customerId))).map(toView);
}

export async function taskById(id: string): Promise<TaskView | null> {
  const [row] = await select(eq(tasks.id, id));
  return row ? toView(row) : null;
}

/** Number of (unarchived) tasks due on each day of a range, optionally for one customer or person. */
export async function countsByDay(from: string, to: string, filter: { customerId?: string; assigneeId?: string; excludeDrafts?: boolean } = {}) {
  const conditions: SQL[] = [eq(tasks.archived, false), gte(tasks.dueDate, from), lte(tasks.dueDate, to)];
  if (filter.customerId) conditions.push(eq(tasks.customerId, filter.customerId));
  if (filter.assigneeId) conditions.push(eq(tasks.assigneeId, filter.assigneeId));
  if (filter.excludeDrafts) conditions.push(sql`${tasks.assigneeId} is not null`);
  const rows = await db
    .select({ date: tasks.dueDate, n: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .where(and(...conditions))
    .groupBy(tasks.dueDate);
  return Object.fromEntries(rows.map((r) => [r.date, r.n])) as Record<string, number>;
}

/** All tasks due on a day, across every customer, drafts included: the "whole day" view. */
export async function wholeDay(date: string): Promise<TaskView[]> {
  return (await select(and(eq(tasks.archived, false), eq(tasks.dueDate, date)))).map(toView);
}

export async function liveStatuses() {
  return db
    .select({ id: statuses.id, name: statuses.name, color: statuses.color, isFinished: statuses.isFinished })
    .from(statuses)
    .where(isNull(statuses.deletedAt))
    .orderBy(asc(statuses.position), asc(statuses.createdAt));
}

export async function listedTaskTypes() {
  return db
    .select({ id: taskTypes.id, name: taskTypes.name, isPublishing: taskTypes.isPublishing })
    .from(taskTypes)
    .where(and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false)))
    .orderBy(asc(taskTypes.position), asc(taskTypes.createdAt));
}

export async function activePeople() {
  return db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
}

export async function allSpecialDays(): Promise<SpecialDay[]> {
  return db.select({ date: specialDays.date, name: specialDays.name, kind: specialDays.kind, yearly: specialDays.yearly }).from(specialDays);
}

export async function customersForFilter(ids: string[]) {
  if (!ids.length) return [];
  return db.select({ id: customers.id, name: customers.name, color: customers.color }).from(customers).where(inArray(customers.id, ids)).orderBy(asc(customers.name));
}
