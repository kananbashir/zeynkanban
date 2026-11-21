"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentTypes, contents, contracts, customers } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole } from "@/lib/auth";
import { cleanContentId, cleanShortName, contractProblem, monthToDate, nextCustomerColor, parseMonth } from "@/lib/content-rules";
import { contractsOf } from "@/lib/customers";
import { cleanName } from "@/lib/settings-rules";
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

export async function addContent(customerId: string, contentTypeId: string, contractId: string, code: string): Promise<Result> {
  await requireRole("admin", "manager");
  const clean = cleanContentId(code);
  if (!clean) return fail("contentIdInvalid");
  const [type] = await db.select({ archived: contentTypes.archived }).from(contentTypes).where(eq(contentTypes.id, contentTypeId));
  if (!type) return fail("notFound");
  if (type.archived) return fail("typeArchived");
  const contract = await db.$count(contracts, and(eq(contracts.id, contractId), eq(contracts.customerId, customerId)));
  if (!contract) return fail("notFound");
  try {
    await db.insert(contents).values({ code: clean, customerId, contentTypeId, contractId });
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

export async function setContentArchived(id: string, archived: boolean): Promise<Result> {
  await requireRole("admin");
  const result = await db.update(contents).set({ archived: !!archived }).where(eq(contents.id, id));
  return found(result) ? done() : fail("notFound");
}
