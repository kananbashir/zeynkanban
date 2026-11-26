import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { bankAccess, customers, taskAssignees, tasks } from "@/db/schema";
import { deliverPush, notify, refOnly, staffIds, taskRef } from "./notify";
import { isStaff, writesBriefs } from "./roles";

// Shared by the content brief and Content bank actions.

type Me = { id: string; name: string; role: string };

/** The people on the (unarchived) tasks of a content ID, each with one of their tasks, earliest first. */
export async function peopleOn(contentId: string) {
  return db
    .select({ userId: taskAssignees.userId, taskId: tasks.id })
    .from(taskAssignees)
    .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
    .where(and(eq(tasks.contentId, contentId), eq(tasks.archived, false)))
    .orderBy(asc(tasks.dueDate));
}

/**
 * Tells the people on the tasks of a content ID that its brief was added or changed (and, when an
 * employee did it, admins and managers too). One notification per person, pointing at one of their tasks.
 */
export async function tellAboutBrief(contentId: string, me: Me, action: "added" | "updated") {
  const byTask = new Map<string, string[]>();
  const seen = new Set<string>();
  const people = await peopleOn(contentId);
  for (const p of people) {
    if (p.userId === me.id || seen.has(p.userId)) continue;
    seen.add(p.userId);
    byTask.set(p.taskId, [...(byTask.get(p.taskId) ?? []), p.userId]);
  }
  const first = people.find((p) => p.userId === me.id)?.taskId ?? people[0]?.taskId;
  if (!isStaff(me.role) && first)
    for (const id of await staffIds(me.id)) {
      if (seen.has(id)) continue;
      seen.add(id);
      byTask.set(first, [...(byTask.get(first) ?? []), id]);
    }
  const rows: Awaited<ReturnType<typeof notify>> = [];
  for (const [taskId, ids] of byTask) {
    const ref = await taskRef(taskId);
    if (ref) rows.push(...(await notify(ids, "brief", { kind: "brief", action, by: me.name, ...refOnly(ref) }, taskId)));
  }
  if (rows.length) after(() => deliverPush(rows));
}

/**
 * The customers someone may use the Content bank for: admins and managers all (not archived), an
 * employee those ticked for them in Settings → Users, a graphic designer none.
 */
export async function bankCustomerIds(me: { id: string; role: string }): Promise<string[]> {
  if (!writesBriefs(me.role)) return [];
  if (isStaff(me.role)) return (await db.select({ id: customers.id }).from(customers).where(eq(customers.archived, false))).map((c) => c.id);
  return (
    await db
      .select({ id: bankAccess.customerId })
      .from(bankAccess)
      .innerJoin(customers, eq(customers.id, bankAccess.customerId))
      .where(and(eq(bankAccess.userId, me.id), eq(customers.archived, false)))
  ).map((c) => c.id);
}

export async function mayUseBank(me: { id: string; role: string }, customerId: string): Promise<boolean> {
  if (!writesBriefs(me.role)) return false;
  if (isStaff(me.role)) return true;
  const [row] = await db
    .select({ id: bankAccess.customerId })
    .from(bankAccess)
    .where(and(eq(bankAccess.userId, me.id), eq(bankAccess.customerId, customerId)));
  return !!row;
}

/** Which of these bank briefs someone may see and change: admins and managers all, others only their own. */
export function ownsBankBrief(me: { id: string; role: string }, createdBy: string): boolean {
  return isStaff(me.role) || createdBy === me.id;
}

/** Replaces which customers an employee may use the Content bank for. */
export async function setBankAccess(userId: string, customerIds: string[]) {
  const known = customerIds.length ? (await db.select({ id: customers.id }).from(customers).where(inArray(customers.id, customerIds))).map((c) => c.id) : [];
  await db.transaction(async (tx) => {
    await tx.delete(bankAccess).where(eq(bankAccess.userId, userId));
    if (known.length) await tx.insert(bankAccess).values(known.map((customerId) => ({ userId, customerId })));
  });
}
