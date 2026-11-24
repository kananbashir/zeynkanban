"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { contentTypes, contents, contracts, customers, taskAssignees, tasks } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole } from "@/lib/auth";
import { cleanContentId, cleanContentNote, cleanShortName, contractProblem, monthToDate, nextCustomerColor, parseMonth } from "@/lib/content-rules";
import { contractsOf } from "@/lib/customers";
import { cleanName } from "@/lib/settings-rules";
import { deliverPush, notify, refOnly, taskRef } from "@/lib/notify";
import { found, isUniqueViolation } from "@/lib/users";

export type Result = { ok: true; id?: string } | { ok: false; error: ErrorKey };
const fail = (error: ErrorKey): Result => ({ ok: false, error });

function done(customerId?: string): Result {
  revalidatePath("/customers", "layout");
  return { ok: true, id: customerId };
}

type InfoInput = { name: string; shortName: string; contactPerson?: string; phone?: string; email?: string; social?: string; notes?: string };

function cleanInfo(input: InfoInput): { ok: true; value: Omit<typeof customers.$inferInsert, "color"> } | { ok: false; error: ErrorKey } {
  const name = cleanName(input.name, 120);
  if (!name.ok) return name;
  const shortName = cleanShortName(input.shortName);
  if (!shortName) return { ok: false, error: "shortNameInvalid" };
  const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return {
    ok: true,
    value: {
      name: name.value,
      shortName,
      contactPerson: text(input.contactPerson, 120),
      phone: text(input.phone, 40),
      email: text(input.email, 120),
      social: text(input.social, 200),
      notes: String(input.notes ?? "").trim().slice(0, 5000) || null,
    },
  };
}

/* ---------- Customers (admin) ---------- */

export async function createCustomer(input: InfoInput & { start: string; end: string }): Promise<Result> {
  await requireRole("admin");
  const info = cleanInfo(input);
  if (!info.ok) return fail(info.error);
  const start = parseMonth(input.start);
  const end = parseMonth(input.end);
  const problem = contractProblem(start, end);
  if (problem) return fail(problem);
  const used = (await db.select({ color: customers.color }).from(customers)).map((c) => c.color);
  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(customers).values({ id, ...info.value, color: nextCustomerColor(used) });
      await tx.insert(contracts).values({ customerId: id, startMonth: monthToDate(start!), endMonth: monthToDate(end!) });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("shortNameTaken");
    throw error;
  }
  return done(id);
}

export async function updateCustomer(id: string, input: InfoInput): Promise<Result> {
  await requireRole("admin");
  const info = cleanInfo(input);
  if (!info.ok) return fail(info.error);
  try {
    const result = await db.update(customers).set({ ...info.value, updatedAt: new Date() }).where(eq(customers.id, id));
    return found(result) ? done(id) : fail("notFound");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("shortNameTaken");
    throw error;
  }
}

export async function renewContract(customerId: string, startValue: string, endValue: string): Promise<Result> {
  await requireRole("admin");
  const start = parseMonth(startValue);
  const end = parseMonth(endValue);
  const problem = contractProblem(start, end);
  if (problem) return fail(problem);
  const [current] = await contractsOf(customerId);
  if (current && monthToDate(start!) <= current.startMonth) return fail("renewalTooEarly");
  const exists = await db.$count(customers, eq(customers.id, customerId));
  if (!exists) return fail("notFound");
  await db.insert(contracts).values({ customerId, startMonth: monthToDate(start!), endMonth: monthToDate(end!) });
  return done(customerId);
}

export async function setCustomerArchived(id: string, archived: boolean): Promise<Result> {
  await requireRole("admin");
  const result = await db.update(customers).set({ archived: !!archived, updatedAt: new Date() }).where(eq(customers.id, id));
  return found(result) ? done(id) : fail("notFound");
}

/* ---------- Content IDs (admin and manager; archiving is admin only) ---------- */

export async function addContent(customerId: string, contentTypeId: string, contractId: string, code: string, note = ""): Promise<Result> {
  const me = await requireRole("admin", "manager");
  const cleanNote = cleanContentNote(note);
  const clean = cleanContentId(code);
  if (!clean) return fail("contentIdInvalid");
  const [type] = await db.select({ archived: contentTypes.archived }).from(contentTypes).where(eq(contentTypes.id, contentTypeId));
  if (!type) return fail("notFound");
  if (type.archived) return fail("typeArchived");
  const contract = await db.$count(contracts, and(eq(contracts.id, contractId), eq(contracts.customerId, customerId)));
  if (!contract) return fail("notFound");
  try {
    await db.insert(contents).values({ code: clean, customerId, contentTypeId, contractId, ...(cleanNote ? { note: cleanNote, noteBy: me.id, noteAt: new Date() } : {}) });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("contentIdTaken");
    throw error;
  }
  return done(customerId);
}

export async function renameContent(id: string, code: string): Promise<Result> {
  await requireRole("admin", "manager");
  const clean = cleanContentId(code);
  if (!clean) return fail("contentIdInvalid");
  try {
    const result = await db.update(contents).set({ code: clean }).where(eq(contents.id, id));
    return found(result) ? done() : fail("notFound");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("contentIdTaken");
    throw error;
  }
}

/**
 * Adds, changes or (when empty) removes the note shown under a content ID on all its task cards.
 * The people on its tasks are told when it is added or changed.
 */
export async function setContentNote(id: string, note: string): Promise<Result & { note?: string | null; by?: string; at?: string }> {
  const me = await requireRole("admin", "manager");
  const [content] = await db.select({ note: contents.note }).from(contents).where(eq(contents.id, id));
  if (!content) return fail("notFound");
  const clean = cleanContentNote(note);
  if (clean === content.note) return { ok: true, note: clean };
  const at = new Date();
  await db.update(contents).set(clean ? { note: clean, noteBy: me.id, noteAt: at } : { note: null, noteBy: null, noteAt: null }).where(eq(contents.id, id));
  if (clean) {
    // One notification per person, pointing at one of their tasks with this content ID.
    const people = await db
      .select({ userId: taskAssignees.userId, taskId: tasks.id })
      .from(taskAssignees)
      .innerJoin(tasks, eq(tasks.id, taskAssignees.taskId))
      .where(and(eq(tasks.contentId, id), eq(tasks.archived, false)))
      .orderBy(asc(tasks.dueDate));
    const byTask = new Map<string, string[]>();
    const seen = new Set<string>([me.id]);
    for (const p of people) {
      if (seen.has(p.userId)) continue;
      seen.add(p.userId);
      byTask.set(p.taskId, [...(byTask.get(p.taskId) ?? []), p.userId]);
    }
    const rows: Awaited<ReturnType<typeof notify>> = [];
    for (const [taskId, who] of byTask) {
      const ref = await taskRef(taskId);
      if (ref) rows.push(...(await notify(who, "contentNote", { kind: "contentNote", action: content.note ? "updated" : "added", by: me.name, text: clean.slice(0, 160), ...refOnly(ref) }, taskId)));
    }
    if (rows.length) after(() => deliverPush(rows));
  }
  revalidatePath("/", "layout");
  return { ok: true, note: clean, by: clean ? me.name : undefined, at: clean ? at.toISOString() : undefined };
}

export async function setContentArchived(id: string, archived: boolean): Promise<Result> {
  await requireRole("admin");
  const result = await db.update(contents).set({ archived: !!archived }).where(eq(contents.id, id));
  return found(result) ? done() : fail("notFound");
}
