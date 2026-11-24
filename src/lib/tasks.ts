import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { contentBriefs, contentTypes, finishedWorks, contents, customers, specialDays, statuses, taskNotes, taskReminders, taskTypes, tasks, users } from "@/db/schema";
import type { Locale } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { assignedTo, assigneesColumn, hasAssignees, noAssignees, parseAssignees, type Person } from "./assignees";
import { addDays, dateInZone, type SpecialDay } from "./dates";
import { localName } from "./names";
import { taskEndColumn } from "./task-end";
import { countPerDay, sectionFor, type Section } from "./task-rules";

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
  /** The task type's icon (see src/lib/task-icons.ts). */
  typeIcon: string;
  isPublishing: boolean;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusDeleted: boolean;
  finished: boolean;
  /** In a status that counts as cancelled (closed, never overdue). */
  cancelled: boolean;
  /** In a status that counts as postponed (open, never overdue). */
  postponed: boolean;
  /** The people on the task, in the order they were picked; none means it is a draft. */
  assignees: Person[];
  /** The task's day: it shows from here. */
  dueDate: string;
  /** Optional last day, after dueDate; until then it shows every day while unfinished. */
  deadline: string | null;
  description: string;
  note: string;
  archived: boolean;
  finishedOn: string | null;
  /** Days before the due date the assignee is reminded (e.g. [1, 3]); empty = no reminder. */
  remindDays: number[];
  remindTime: string | null;
  notesCount: number;
  /** The task's content ID has a content brief. */
  hasBrief: boolean;
  /** Its content ID has finished work (links to the final video, design or post). */
  hasFinishedWork: boolean;
};

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
      typeNameEn: taskTypes.nameEn,
      typeDeletedAt: taskTypes.deletedAt,
      typeIcon: taskTypes.icon,
      isPublishing: taskTypes.isPublishing,
      statusId: tasks.statusId,
      statusName: statuses.name,
      statusNameEn: statuses.nameEn,
      statusColor: statuses.color,
      statusDeletedAt: statuses.deletedAt,
      finished: statuses.isFinished,
      cancelled: statuses.isCancelled,
      postponed: statuses.isPostponed,
      assignees: assigneesColumn,
      dueDate: tasks.dueDate,
      deadline: tasks.deadline,
      description: tasks.description,
      note: tasks.note,
      archived: tasks.archived,
      finishedAt: tasks.finishedAt,
      remindDays: sql<string | null>`(select group_concat(${taskReminders.daysBefore} order by ${taskReminders.daysBefore}) from ${taskReminders} where ${taskReminders.taskId} = ${tasks.id})`,
      remindTime: tasks.remindTime,
      notesCount: sql<number>`(select count(*) from ${taskNotes} where ${taskNotes.taskId} = ${tasks.id})`.mapWith(Number),
      hasBrief: sql<boolean>`exists (select 1 from ${contentBriefs} where ${contentBriefs.contentId} = ${tasks.contentId})`.mapWith(Boolean),
      hasFinishedWork: sql<boolean>`exists (select 1 from ${finishedWorks} where ${finishedWorks.contentId} = ${tasks.contentId})`.mapWith(Boolean),
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(customers, eq(customers.id, tasks.customerId))
    .innerJoin(contents, eq(contents.id, tasks.contentId))
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .innerJoin(taskTypes, eq(taskTypes.id, tasks.taskTypeId))
    .innerJoin(statuses, eq(statuses.id, tasks.statusId))
    .where(where)
    .orderBy(asc(tasks.dueDate), asc(customers.name), asc(tasks.createdAt));
}

type Row = Awaited<ReturnType<typeof select>>[number];

function toView(row: Row, locale: Locale): TaskView {
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
    typeName: localName(row.typeName, row.typeNameEn, locale),
    typeDeleted: !!row.typeDeletedAt,
    typeIcon: row.typeIcon,
    isPublishing: row.isPublishing,
    statusId: row.statusId,
    statusName: localName(row.statusName, row.statusNameEn, locale),
    statusColor: row.statusColor,
    statusDeleted: !!row.statusDeletedAt,
    finished: row.finished && !row.cancelled,
    cancelled: row.cancelled,
    postponed: row.postponed && !row.finished && !row.cancelled,
    assignees: parseAssignees(row.assignees),
    dueDate: row.dueDate,
    deadline: row.deadline && row.deadline > row.dueDate ? row.deadline : null,
    description: row.description ?? "",
    note: row.note,
    archived: row.archived,
    finishedOn: row.finishedAt ? dateInZone(row.finishedAt) : null,
    remindDays: row.remindDays ? String(row.remindDays).split(",").map(Number) : [],
    remindTime: row.remindTime,
    notesCount: row.notesCount,
    hasBrief: row.hasBrief,
    hasFinishedWork: row.hasFinishedWork,
  };
}

export type DayTasks = Record<Section, TaskView[]>;

/**
 * The tasks shown on a day view: overdue (today only), due that day, and finished that day.
 * Drafts (nobody on them) are left out unless asked for. Optional filters narrow it to one customer or person.
 */
export async function dayTasks(date: string, today: string, filter: { customerId?: string; assigneeId?: string; includeDrafts?: boolean } = {}): Promise<DayTasks> {
  const locale = await getLocale();
  const conditions: SQL[] = [eq(tasks.archived, false)];
  if (filter.customerId) conditions.push(eq(tasks.customerId, filter.customerId));
  if (filter.assigneeId) conditions.push(assignedTo(filter.assigneeId));
  if (!filter.includeDrafts) conditions.push(hasAssignees);
  // Candidates: spanning that day (from their day to their deadline), unfinished late ones (when
  // viewing today), or finished around that day.
  const around = or(
    and(lte(tasks.dueDate, date), gte(taskEndColumn, date)),
    date === today ? lt(taskEndColumn, today) : undefined,
    and(gte(tasks.finishedAt, new Date(`${addDays(date, -1)}T00:00:00Z`)), lt(tasks.finishedAt, new Date(`${addDays(date, 2)}T00:00:00Z`))),
  );
  const rows = (await select(and(...conditions, around))).map((row) => toView(row, locale));
  const out: DayTasks = { overdue: [], due: [], postponed: [], finished: [], cancelled: [] };
  for (const task of rows) {
    const section = sectionFor(task, date, today);
    if (section) out[section].push(task);
  }
  return out;
}

/** Drafts of a customer: tasks nobody is on yet, in date order. */
export async function draftsOf(customerId: string): Promise<TaskView[]> {
  const locale = await getLocale();
  return (await select(and(eq(tasks.customerId, customerId), eq(tasks.archived, false), noAssignees))).map((row) => toView(row, locale));
}

/** Every task of a customer (archived ones too), for the Contents tab. */
export async function tasksOfCustomer(customerId: string): Promise<TaskView[]> {
  const locale = await getLocale();
  return (await select(eq(tasks.customerId, customerId))).map((row) => toView(row, locale));
}

export async function taskById(id: string): Promise<TaskView | null> {
  const [row] = await select(eq(tasks.id, id));
  return row ? toView(row, await getLocale()) : null;
}

/** Number of (unarchived) tasks on each day of a range, optionally for one customer or person. A task with a deadline counts on every day it spans. */
export async function countsByDay(from: string, to: string, filter: { customerId?: string; assigneeId?: string; excludeDrafts?: boolean } = {}) {
  const conditions: SQL[] = [eq(tasks.archived, false), lte(tasks.dueDate, to), gte(taskEndColumn, from)];
  if (filter.customerId) conditions.push(eq(tasks.customerId, filter.customerId));
  if (filter.assigneeId) conditions.push(assignedTo(filter.assigneeId));
  if (filter.excludeDrafts) conditions.push(hasAssignees);
  const rows = await db.select({ dueDate: tasks.dueDate, deadline: tasks.deadline }).from(tasks).where(and(...conditions));
  return countPerDay(rows, from, to, addDays);
}

/** All tasks on a day (including those whose day-to-deadline span covers it), across every customer, drafts included: the "whole day" view. */
export async function wholeDay(date: string): Promise<TaskView[]> {
  const locale = await getLocale();
  return (await select(and(eq(tasks.archived, false), lte(tasks.dueDate, date), gte(taskEndColumn, date)))).map((row) => toView(row, locale));
}

/** Statuses to choose from, named in the reader's language. */
export async function liveStatuses() {
  const locale = await getLocale();
  const rows = await db
    .select({ id: statuses.id, name: statuses.name, nameEn: statuses.nameEn, color: statuses.color, isFinished: statuses.isFinished, isCancelled: statuses.isCancelled, isPostponed: statuses.isPostponed })
    .from(statuses)
    .where(isNull(statuses.deletedAt))
    .orderBy(asc(statuses.position), asc(statuses.createdAt));
  return rows.map(({ nameEn, ...row }) => ({ ...row, name: localName(row.name, nameEn, locale) }));
}

/** Task types to choose from, named in the reader's language. */
export async function listedTaskTypes() {
  const locale = await getLocale();
  const rows = await db
    .select({ id: taskTypes.id, name: taskTypes.name, nameEn: taskTypes.nameEn, isPublishing: taskTypes.isPublishing, icon: taskTypes.icon })
    .from(taskTypes)
    .where(and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false)))
    .orderBy(asc(taskTypes.position), asc(taskTypes.createdAt));
  return rows.map(({ nameEn, ...row }) => ({ ...row, name: localName(row.name, nameEn, locale) }));
}

export async function activePeople() {
  return db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
}

/** Holidays and special events, named in the reader's language. */
export async function allSpecialDays(): Promise<SpecialDay[]> {
  const locale = await getLocale();
  const rows = await db.select({ date: specialDays.date, name: specialDays.name, nameEn: specialDays.nameEn, kind: specialDays.kind, yearly: specialDays.yearly }).from(specialDays);
  return rows.map(({ nameEn, ...row }) => ({ ...row, name: localName(row.name, nameEn, locale) }));
}

export async function customersForFilter(ids: string[]) {
  if (!ids.length) return [];
  return db.select({ id: customers.id, name: customers.name, color: customers.color }).from(customers).where(inArray(customers.id, ids)).orderBy(asc(customers.name));
}
