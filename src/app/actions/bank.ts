"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bankBriefs, contentBriefs, customers } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { cleanBankTitle } from "@/lib/bank-rules";
import { cleanBrief, parseBrief } from "@/lib/brief-rules";
import { mayUseBank, ownsBankBrief, tellAboutBrief } from "@/lib/briefs";

// Content bank: briefs written ahead for a customer. Admins and managers may write for any customer and
// change any brief; an employee only for the customers ticked for them, and only their own briefs.
// Graphic designers can't use it.

type Fail = { ok: false; error: ErrorKey; fieldId?: string };

async function own(id: string) {
  const me = await requireUser();
  const [brief] = await db.select().from(bankBriefs).where(eq(bankBriefs.id, String(id)));
  if (!brief) return { me, brief: null, allowed: false };
  return { me, brief, allowed: ownsBankBrief(me, brief.createdBy) && (await mayUseBank(me, brief.customerId)) };
}

/** Adds a bank brief (no `id`) or saves one; a brief in use saves the content ID's brief too (and tells its people). */
export async function saveBankBrief(input: { id?: string; customerId: string; title: string; fields: unknown }): Promise<{ ok: true; id: string } | Fail> {
  const me = await requireUser();
  const title = cleanBankTitle(input.title);
  if (!title) return { ok: false, error: "bankTitleMissing" };
  const clean = cleanBrief(input.fields);
  if (!clean.ok) return { ok: false, error: clean.error, fieldId: clean.fieldId };
  const json = JSON.stringify(clean.fields);

  if (!input.id) {
    const [customer] = await db.select({ archived: customers.archived }).from(customers).where(eq(customers.id, String(input.customerId)));
    if (!customer || customer.archived) return { ok: false, error: "notFound" };
    if (!(await mayUseBank(me, input.customerId))) return { ok: false, error: "notAllowed" };
    const id = crypto.randomUUID();
    await db.insert(bankBriefs).values({ id, customerId: input.customerId, title, fields: json, createdBy: me.id, updatedBy: me.id });
    revalidatePath("/bank");
    return { ok: true, id };
  }

  const { brief, allowed } = await own(input.id);
  if (!brief) return { ok: false, error: "notFound" };
  if (!allowed) return { ok: false, error: "notAllowed" };
  const [linked] = await db.select({ contentId: contentBriefs.contentId }).from(contentBriefs).where(eq(contentBriefs.bankBriefId, brief.id));
  const changed = json !== brief.fields;
  await db.transaction(async (tx) => {
    await tx.update(bankBriefs).set({ title, fields: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(bankBriefs.id, brief.id));
    if (linked && changed) await tx.update(contentBriefs).set({ fields: json, updatedBy: me.id, updatedAt: new Date() }).where(eq(contentBriefs.contentId, linked.contentId));
  });
  if (linked && changed) {
    await tellAboutBrief(linked.contentId, me, "updated");
    revalidatePath("/", "layout");
  } else revalidatePath("/bank");
  return { ok: true, id: brief.id };
}

/** A copy of a bank brief under a new title, unused, written by whoever made the copy. */
export async function duplicateBankBrief(id: string, title: string): Promise<{ ok: true; id: string } | Fail> {
  const { me, brief, allowed } = await own(id);
  if (!brief) return { ok: false, error: "notFound" };
  if (!allowed) return { ok: false, error: "notAllowed" };
  const name = cleanBankTitle(title);
  if (!name) return { ok: false, error: "bankTitleMissing" };
  const copy = crypto.randomUUID();
  await db.insert(bankBriefs).values({ id: copy, customerId: brief.customerId, title: name, fields: JSON.stringify(parseBrief(brief.fields)), createdBy: me.id, updatedBy: me.id });
  revalidatePath("/bank");
  return { ok: true, id: copy };
}

/** Deletes a bank brief. A content ID that used it keeps its brief, no longer linked. */
export async function deleteBankBrief(id: string): Promise<{ ok: true } | Fail> {
  const { brief, allowed } = await own(id);
  if (!brief) return { ok: true };
  if (!allowed) return { ok: false, error: "notAllowed" };
  let unlinked = false;
  await db.transaction(async (tx) => {
    const [linked] = await tx.select({ contentId: contentBriefs.contentId }).from(contentBriefs).where(eq(contentBriefs.bankBriefId, brief.id));
    if (linked) {
      unlinked = true;
      await tx.update(contentBriefs).set({ bankBriefId: null }).where(eq(contentBriefs.contentId, linked.contentId));
    }
    await tx.delete(bankBriefs).where(eq(bankBriefs.id, brief.id));
  });
  revalidatePath(unlinked ? "/" : "/bank", unlinked ? "layout" : undefined);
  return { ok: true };
}
