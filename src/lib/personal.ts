import "server-only";
import { and, asc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { personalTasks } from "@/db/schema";

export type PersonalTask = { id: string; title: string; note: string; dueDate: string; done: boolean };

/** One person's personal tasks shown on a day (see personalShownOn). Unfinished first. */
export async function personalForDay(ownerId: string, date: string, today: string): Promise<PersonalTask[]> {
  const day = date === today ? or(eq(personalTasks.dueDate, date), and(lt(personalTasks.dueDate, today), eq(personalTasks.done, false))) : eq(personalTasks.dueDate, date);
  return db
    .select({ id: personalTasks.id, title: personalTasks.title, note: personalTasks.note, dueDate: personalTasks.dueDate, done: personalTasks.done })
    .from(personalTasks)
    .where(and(eq(personalTasks.ownerId, ownerId), day))
    .orderBy(asc(personalTasks.done), asc(personalTasks.dueDate), asc(personalTasks.createdAt));
}

/** How many personal tasks a person has per day, for their calendar. */
export async function personalCounts(ownerId: string, from: string, to: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ date: personalTasks.dueDate, n: sql<number>`count(*)`.mapWith(Number) })
    .from(personalTasks)
    .where(and(eq(personalTasks.ownerId, ownerId), gte(personalTasks.dueDate, from), lte(personalTasks.dueDate, to)))
    .groupBy(personalTasks.dueDate);
  return Object.fromEntries(rows.map((r) => [r.date, r.n]));
}
