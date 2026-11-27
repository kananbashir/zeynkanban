"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bankApprovers, bankBriefs, bankNotes, contentBriefs, customers } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { allApproved, cleanBankNote, cleanBankTitle, mayApprove, mayEditBank, mayRemoveBank } from "@/lib/bank-rules";
import { cleanBrief, parseBrief } from "@/lib/brief-rules";
import { approverChoices, askedFor, bankState, mayUseBank, resetApproval, tellAboutBrief, tellBank } from "@/lib/briefs";
import { isStaff } from "@/lib/roles";

// Content bank: briefs written ahead for a customer. Admins and managers may write for any customer and
// change any brief; an employee only for the customers ticked for them, and only their own briefs (or
// ones they are asked to approve). Graphic designers can't use it. Every brief waits for approval
// before it can be picked for a content ID (see mayApprove in src/lib/bank-rules.ts).

type Fail = { ok: false; error: ErrorKey; fieldId?: string };
type Me = Awaited<ReturnType<typeof requireUser>>;

const isApprover = (state: { approvers: { userId: string }[] }, me: Me) => state.approvers.some((a) => a.userId === me.id);

/** Who may be asked to approve: employees who use the bank for this customer (others are dropped). */
async function cleanApprovers(customerId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids)) return [];
  const allowed = new Set(await approverChoices(customerId));
  return [...new Set(ids.map(String))].filter((id) => allowed.has(id));
}

/**
 * Adds a bank brief (no `id`) or saves one. A new one waits for approval: by the approvers an admin or
 * manager picked, or else by its author (and, for an employee's brief, admins and managers). Saving a
 * change takes every approval back; an approver who edits approves with the edit and says what changed
 * (`note`, required for them). A brief in use saves the content ID's brief too.
 */
export async function saveBankBrief(input: { id?: string; customerId: string; title: string; fields: unknown; approvers?: string[]; note?: string }): Promise<{ ok: true; id: string } | Fail> {
  const me = await requireUser();
  const title = cleanBankTitle(input.title);
  if (!title) return { ok: false, error: "bankTitleMissing" };
  const clean = cleanBrief(input.fields);
  if (!clean.ok) return { ok: false, error: clean.error, fieldId: clean.fieldId };
  const json = JSON.stringify(clean.fields);

  if (!input.id) {
    const [customer] = await db.select({ name: customers.name, archived: customers.archived }).from(customers).where(eq(customers.id, String(input.customerId)));
    if (!customer || customer.archived) return { ok: false, error: "notFound" };
    if (!(await mayUseBank(me, input.customerId))) return { ok: false, error: "notAllowed" };
    const approvers = isStaff(me.role) ? await cleanApprovers(input.customerId, input.approvers) : [];
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(bankBriefs).values({ id, customerId: input.customerId, title, fields: json, createdBy: me.id, updatedBy: me.id });
      if (approvers.length) await tx.insert(bankApprovers).values(approvers.map((userId) => ({ bankBriefId: id, userId })));
    });
    const brief = { id, title, customer: customer.name, customerId: input.customerId };
    await tellBank(await askedFor({ authorId: me.id, authorRole: me.role, approvers: approvers.map((userId) => ({ userId, approvedAt: null, edited: false })) }), "approve", brief, me);
    revalidatePath("/bank");
    return { ok: true, id };
  }

  const state = await bankState(input.id);
  if (!state) return { ok: false, error: "notFound" };
  const approver = isApprover(state, me);
  if (!mayEditBank(me, state.authorId, state.approvers.map((a) => a.userId)) || (!approver && !(await mayUseBank(me, state.customerId)))) return { ok: false, error: "notAllowed" };
  // An approver's edit is also their approval, with a note on what changed.
  const note = approver ? cleanBankNote(input.note) : "";
  if (approver && !note) return { ok: false, error: "bankNoteMissing" };

  // Admins and managers may change who approves; those who stay keep their approval unless the brief changed.
  let approverIds = state.approvers.map((a) => a.userId);
  if (isStaff(me.role) && Array.isArray(input.approvers)) approverIds = await cleanApprovers(state.customerId, input.approvers);
  const added = approverIds.filter((id) => !state.approvers.some((a) => a.userId === id));
  const removed = state.approvers.filter((a) => !approverIds.includes(a.userId)).map((a) => a.userId);
  const changed = json !== state.fields || title !== state.title;
  const [linked] = await db.select({ contentId: contentBriefs.contentId }).from(contentBriefs).where(eq(contentBriefs.bankBriefId, state.id));

  await db.transaction(async (tx) => {
    await tx.update(bankBriefs).set({ title, fields: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(bankBriefs.id, state.id));
    for (const userId of removed) await tx.delete(bankApprovers).where(and(eq(bankApprovers.bankBriefId, state.id), eq(bankApprovers.userId, userId)));
    if (added.length) await tx.insert(bankApprovers).values(added.map((userId) => ({ bankBriefId: state.id, userId })));
    if (linked && changed) await tx.update(contentBriefs).set({ fields: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(contentBriefs.contentId, linked.contentId));
    if (note) await tx.insert(bankNotes).values({ bankBriefId: state.id, userId: me.id, body: note, edited: true });
  });

  const brief = { id: state.id, title, customer: state.customer, customerId: state.customerId };
  let approved = false;
  if (changed) approved = await resetApproval(state.id, approver ? me.id : null);
  else if (approver) {
    // Nothing changed in the brief itself: the note and the approval still count.
    await db.update(bankApprovers).set({ approvedAt: new Date(), edited: true }).where(and(eq(bankApprovers.bankBriefId, state.id), eq(bankApprovers.userId, me.id)));
    approved = await settle(state.id, me.id);
  } else if (added.length || removed.length) approved = await settle(state.id, null);
  const after = await bankState(state.id);
  if (after) {
    if (approver) await tellBank([state.authorId, ...after.approvers.map((a) => a.userId)], "edited", brief, me, note);
    if (changed) await tellBank((await askedFor(after)).filter((id) => !added.includes(id)), "changed", brief, me);
    if (added.length) await tellBank(added, "approve", brief, me);
    if (approved) await tellBank([state.authorId], "approved", brief, me);
  }
  if (linked && changed) {
    await tellAboutBrief(linked.contentId, me, "updated");
    revalidatePath("/", "layout");
  } else revalidatePath("/bank");
  return { ok: true, id: state.id };
}

/** With approvers, approved once all of them are (and no longer once one is taken back or added). */
async function settle(briefId: string, by: string | null): Promise<boolean> {
  const approvers = await db.select({ approvedAt: bankApprovers.approvedAt }).from(bankApprovers).where(eq(bankApprovers.bankBriefId, briefId));
  if (!approvers.length) return false;
  const done = allApproved(approvers);
  const [brief] = await db.select({ approvedAt: bankBriefs.approvedAt }).from(bankBriefs).where(eq(bankBriefs.id, briefId));
  if (done && !brief?.approvedAt) {
    await db.update(bankBriefs).set({ approvedAt: new Date(), approvedBy: by }).where(eq(bankBriefs.id, briefId));
    return true;
  }
  if (!done && brief?.approvedAt) await db.update(bankBriefs).set({ approvedAt: null, approvedBy: null }).where(eq(bankBriefs.id, briefId));
  return false;
}

/** Approves a brief: as one of its approvers, or (without approvers) as its author, or an admin or manager for an employee's brief. */
export async function approveBankBrief(id: string): Promise<{ ok: true; approved: boolean } | Fail> {
  const me = await requireUser();
  const state = await bankState(id);
  if (!state) return { ok: false, error: "notFound" };
  if (!mayApprove(me, state)) return { ok: false, error: "notAllowed" };
  const brief = { id: state.id, title: state.title, customer: state.customer, customerId: state.customerId };
  let approved: boolean;
  if (state.approvers.length) {
    await db.update(bankApprovers).set({ approvedAt: new Date() }).where(and(eq(bankApprovers.bankBriefId, state.id), eq(bankApprovers.userId, me.id)));
    approved = await settle(state.id, me.id);
  } else {
    await db.update(bankBriefs).set({ approvedAt: new Date(), approvedBy: me.id }).where(eq(bankBriefs.id, state.id));
    approved = true;
  }
  if (approved) await tellBank([state.authorId], "approved", brief, me);
  revalidatePath("/bank");
  return { ok: true, approved };
}

/** A note on a brief (without approving it), by its author, an approver, or an admin or manager. Everyone else involved is told. */
export async function addBankNote(id: string, body: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const state = await bankState(id);
  if (!state) return { ok: false, error: "notFound" };
  if (!mayEditBank(me, state.authorId, state.approvers.map((a) => a.userId))) return { ok: false, error: "notAllowed" };
  const text = cleanBankNote(body);
  if (!text) return { ok: false, error: "noteEmpty" };
  await db.insert(bankNotes).values({ bankBriefId: state.id, userId: me.id, body: text });
  await tellBank([state.authorId, ...state.approvers.map((a) => a.userId)], "note", { id: state.id, title: state.title, customer: state.customer, customerId: state.customerId }, me, text);
  revalidatePath("/bank");
  return { ok: true };
}

/** A copy of a bank brief under a new title, unused and waiting for approval, written by whoever made the copy. */
export async function duplicateBankBrief(id: string, title: string): Promise<{ ok: true; id: string } | Fail> {
  const me = await requireUser();
  const state = await bankState(id);
  if (!state) return { ok: false, error: "notFound" };
  if (!mayRemoveBank(me, state.authorId) || !(await mayUseBank(me, state.customerId))) return { ok: false, error: "notAllowed" };
  const name = cleanBankTitle(title);
  if (!name) return { ok: false, error: "bankTitleMissing" };
  const copy = crypto.randomUUID();
  await db.insert(bankBriefs).values({ id: copy, customerId: state.customerId, title: name, fields: JSON.stringify(parseBrief(state.fields)), createdBy: me.id, updatedBy: me.id });
  await tellBank(await askedFor({ authorId: me.id, authorRole: me.role, approvers: [] }), "approve", { id: copy, title: name, customer: state.customer, customerId: state.customerId }, me);
  revalidatePath("/bank");
  return { ok: true, id: copy };
}

/** Deletes a bank brief (its author, or an admin or manager). A content ID that used it keeps its brief, no longer linked. */
export async function deleteBankBrief(id: string): Promise<{ ok: true } | Fail> {
  const me = await requireUser();
  const state = await bankState(id);
  if (!state) return { ok: true };
  if (!mayRemoveBank(me, state.authorId) || !(await mayUseBank(me, state.customerId))) return { ok: false, error: "notAllowed" };
  let unlinked = false;
  await db.transaction(async (tx) => {
    const [linked] = await tx.select({ contentId: contentBriefs.contentId }).from(contentBriefs).where(eq(contentBriefs.bankBriefId, state.id));
    if (linked) {
      unlinked = true;
      await tx.update(contentBriefs).set({ bankBriefId: null }).where(eq(contentBriefs.contentId, linked.contentId));
    }
    await tx.delete(bankBriefs).where(eq(bankBriefs.id, state.id));
  });
  revalidatePath(unlinked ? "/" : "/bank", unlinked ? "layout" : undefined);
  return { ok: true };
}
