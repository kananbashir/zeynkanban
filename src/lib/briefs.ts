import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { bankAccess, bankApprovers, bankBriefs, customers, taskAssignees, tasks, users } from "@/db/schema";
import { allApproved } from "./bank-rules";
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

/* ---------- Content bank approval ---------- */

/** A bank brief with what decides its approval: its author (and their role) and its approvers. */
export async function bankState(id: string) {
  const [brief] = await db
    .select({ id: bankBriefs.id, customerId: bankBriefs.customerId, title: bankBriefs.title, fields: bankBriefs.fields, createdBy: bankBriefs.createdBy, approvedAt: bankBriefs.approvedAt, authorRole: users.role, customer: customers.name })
    .from(bankBriefs)
    .innerJoin(users, eq(users.id, bankBriefs.createdBy))
    .innerJoin(customers, eq(customers.id, bankBriefs.customerId))
    .where(eq(bankBriefs.id, String(id)));
  if (!brief) return null;
  const approvers = await db.select({ userId: bankApprovers.userId, approvedAt: bankApprovers.approvedAt, edited: bankApprovers.edited }).from(bankApprovers).where(eq(bankApprovers.bankBriefId, brief.id));
  return { ...brief, authorId: brief.createdBy, approvers };
}
export type BankState = NonNullable<Awaited<ReturnType<typeof bankState>>>;

/** Tells people about a bank brief (in the site and by push). */
export async function tellBank(userIds: string[], event: "approve" | "changed" | "approved" | "note" | "edited", brief: { id: string; title: string; customer: string; customerId: string }, me: { id: string; name: string }, note?: string) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== me.id);
  if (!ids.length) return;
  const rows = await notify(ids, "bank", { kind: "bank", event, briefId: brief.id, title: brief.title, customer: brief.customer, customerId: brief.customerId, by: me.name, ...(note ? { note } : {}) });
  if (rows.length) after(() => deliverPush(rows));
}

/**
 * Who is asked when a brief needs approving: its approvers; without any, an admin's or manager's brief
 * waits for its author alone, and an employee's brief also for the admins and managers.
 */
export async function askedFor(state: Pick<BankState, "authorId" | "authorRole" | "approvers">): Promise<string[]> {
  if (state.approvers.length) return state.approvers.filter((a) => !a.approvedAt).map((a) => a.userId);
  if (isStaff(state.authorRole)) return [state.authorId];
  return [state.authorId, ...(await staffIds())];
}

/**
 * The brief changed: every approval is taken back (an approver who edited it approves with the edit),
 * and it waits for approval again. Returns whether it is approved after all (one approver who edited it).
 */
export async function resetApproval(briefId: string, editorApprover: string | null): Promise<boolean> {
  await db.update(bankApprovers).set({ approvedAt: null, edited: false }).where(eq(bankApprovers.bankBriefId, briefId));
  if (editorApprover) await db.update(bankApprovers).set({ approvedAt: new Date(), edited: true }).where(and(eq(bankApprovers.bankBriefId, briefId), eq(bankApprovers.userId, editorApprover)));
  const approvers = await db.select({ approvedAt: bankApprovers.approvedAt }).from(bankApprovers).where(eq(bankApprovers.bankBriefId, briefId));
  const done = allApproved(approvers);
  await db.update(bankBriefs).set(done ? { approvedAt: new Date(), approvedBy: editorApprover } : { approvedAt: null, approvedBy: null }).where(eq(bankBriefs.id, briefId));
  return done;
}

/** Employees (active) who may use the Content bank for a customer: those who can be asked to approve its briefs. */
export async function approverChoices(customerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(bankAccess, and(eq(bankAccess.userId, users.id), eq(bankAccess.customerId, customerId)))
    .where(and(eq(users.role, "employee"), eq(users.active, true)));
  return rows.map((r) => r.id);
}

/** Bank briefs someone is asked to approve (for employees, who otherwise see only their own). */
export async function approverBriefIds(userId: string): Promise<string[]> {
  return (await db.select({ id: bankApprovers.bankBriefId }).from(bankApprovers).where(eq(bankApprovers.userId, userId))).map((r) => r.id);
}

/** A changed linked brief (edited from a task's brief window) waits for approval in the bank again. */
export async function bankChangedFromTask(bankBriefId: string, me: { id: string; name: string }) {
  await resetApproval(bankBriefId, null);
  const state = await bankState(bankBriefId);
  if (state) await tellBank(await askedFor(state), "changed", state, me);
}

