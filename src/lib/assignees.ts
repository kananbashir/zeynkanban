import "server-only";
import { sql } from "drizzle-orm";
import { taskAssignees, tasks, users } from "@/db/schema";

export type Person = { id: string; name: string };

/** The people on each task, in the order they were picked: "<36-character id><name>" lines. */
export const assigneesColumn = sql<string | null>`(select group_concat(concat(${users.id}, ${users.name}) order by ${taskAssignees.position}, ${users.name} separator '\\n') from ${taskAssignees} inner join ${users} on ${users.id} = ${taskAssignees.userId} where ${taskAssignees.taskId} = ${tasks.id})`;

export function parseAssignees(raw: string | null | undefined): Person[] {
  if (!raw) return [];
  return String(raw)
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ id: line.slice(0, 36), name: line.slice(36) }));
}

/** Tasks someone is on (not drafts). */
export const hasAssignees = sql`exists (select 1 from ${taskAssignees} where ${taskAssignees.taskId} = ${tasks.id})`;
/** Drafts: tasks nobody is on. */
export const noAssignees = sql`not exists (select 1 from ${taskAssignees} where ${taskAssignees.taskId} = ${tasks.id})`;
/** Tasks a given person is on. */
export const assignedTo = (userId: string) => sql`exists (select 1 from ${taskAssignees} where ${taskAssignees.taskId} = ${tasks.id} and ${taskAssignees.userId} = ${userId})`;
