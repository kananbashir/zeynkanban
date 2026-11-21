"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentTypes, DAY_KINDS, ROLES, specialDays, statuses, taskTypes, users, type DayKind, type Role } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole } from "@/lib/auth";
import { isContentTypeInUse } from "@/lib/customers";
import { endSessionsOf } from "@/lib/session";
import {
  cleanContentCode,
  cleanName,
  isIsoDate,
  isSameSet,
  isStatusColor,
  nextStatusColor,
  statusDeleteProblem,
  unfinishProblem,
} from "@/lib/settings-rules";
import { found, insertUserWithCode, isUniqueViolation, replaceCode } from "@/lib/users";

export type Result = { ok: true } | { ok: false; error: ErrorKey };
const OK: Result = { ok: true };
const fail = (error: ErrorKey): Result => ({ ok: false, error });

function done(): Result {
  revalidatePath("/settings");
  return OK;
}

const isRole = (value: unknown): value is Role => (ROLES as readonly string[]).includes(String(value));
const isDayKind = (value: unknown): value is DayKind => (DAY_KINDS as readonly string[]).includes(String(value));

/* ---------- Users ---------- */

export async function createUser(name: string, role: string): Promise<Result & { id?: string; code?: string }> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  if (!isRole(role)) return fail("generic");
  const created = await insertUserWithCode(clean.value, role);
  revalidatePath("/settings");
  return { ok: true, ...created };
}

export async function renameUser(id: string, name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const rows = await db.update(users).set({ name: clean.value, updatedAt: new Date() }).where(eq(users.id, id));
  return found(rows) ? done() : fail("notFound");
}

export async function setUserRole(id: string, role: string): Promise<Result> {
  const me = await requireRole("admin");
  if (id === me.id) return fail("self"); // keeps at least one admin: the one making changes
  if (!isRole(role)) return fail("generic");
  const rows = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
  return found(rows) ? done() : fail("notFound");
}

export async function setUserActive(id: string, active: boolean): Promise<Result> {
  const me = await requireRole("admin");
  if (id === me.id) return fail("self");
  const rows = await db.update(users).set({ active: !!active, updatedAt: new Date() }).where(eq(users.id, id));
  if (!found(rows)) return fail("notFound");
  if (!active) await endSessionsOf(id); // logged out everywhere at once
  return done();
}

export async function newUserCode(id: string): Promise<Result & { code?: string }> {
  await requireRole("admin");
  const code = await replaceCode(id, async (codeHash) => {
    const rows = await db.update(users).set({ codeHash, updatedAt: new Date() }).where(eq(users.id, id));
    return found(rows);
  });
  if (!code) return fail("notFound");
  await endSessionsOf(id); // the old code, and everyone logged in with it, stops working
  revalidatePath("/settings");
  return { ok: true, code };
}

/* ---------- Statuses ---------- */

async function liveStatuses() {
  return db
    .select({ id: statuses.id, isFinished: statuses.isFinished, color: statuses.color })
    .from(statuses)
    .where(isNull(statuses.deletedAt))
    .orderBy(asc(statuses.position));
}

export async function addStatus(name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const live = await liveStatuses();
  await db.insert(statuses).values({
    name: clean.value,
    color: nextStatusColor(live.map((s) => s.color)),
    position: live.length,
  });
  return done();
}

export async function renameStatus(id: string, name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const rows = await db.update(statuses).set({ name: clean.value }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

export async function setStatusColor(id: string, color: string): Promise<Result> {
  await requireRole("admin");
  if (!isStatusColor(color)) return fail("generic");
  const rows = await db.update(statuses).set({ color }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

export async function setStatusFinished(id: string, finished: boolean): Promise<Result> {
  await requireRole("admin");
  if (!finished) {
    const problem = unfinishProblem(await liveStatuses(), id);
    if (problem) return fail(problem);
  }
  const rows = await db.update(statuses).set({ isFinished: !!finished }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

export async function reorderStatuses(ids: string[]): Promise<Result> {
  await requireRole("admin");
  const live = await liveStatuses();
  if (!isSameSet(live.map((s) => s.id), ids)) return fail("notFound");
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) await tx.update(statuses).set({ position }).where(eq(statuses.id, id));
  });
  return done();
}

export async function deleteStatus(id: string): Promise<Result> {
  await requireRole("admin");
  const problem = statusDeleteProblem(await liveStatuses(), id);
  if (problem) return fail(problem);
  // Only marked as deleted: tasks that use it keep showing its name and whether it counted as finished.
  const rows = await db.update(statuses).set({ deletedAt: new Date() }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

/* ---------- Task types ---------- */

async function liveTaskTypes() {
  return db
    .select({ id: taskTypes.id, isPublishing: taskTypes.isPublishing })
    .from(taskTypes)
    .where(isNull(taskTypes.deletedAt))
    .orderBy(asc(taskTypes.position));
}

export async function addTaskType(name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const live = await liveTaskTypes();
  await db.insert(taskTypes).values({ name: clean.value, position: live.length });
  return done();
}

export async function renameTaskType(id: string, name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const rows = await db.update(taskTypes).set({ name: clean.value }).where(and(eq(taskTypes.id, id), isNull(taskTypes.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

export async function reorderTaskTypes(ids: string[]): Promise<Result> {
  await requireRole("admin");
  const live = await liveTaskTypes();
  if (!isSameSet(live.map((t) => t.id), ids)) return fail("notFound");
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) await tx.update(taskTypes).set({ position }).where(eq(taskTypes.id, id));
  });
  return done();
}

export async function deleteTaskType(id: string): Promise<Result> {
  await requireRole("admin");
  const target = (await liveTaskTypes()).find((t) => t.id === id);
  if (!target) return fail("notFound");
  if (target.isPublishing) return fail("publishingType");
  await db.update(taskTypes).set({ deletedAt: new Date() }).where(eq(taskTypes.id, id));
  return done();
}

/* ---------- Content types ---------- */

export async function addContentType(code: string, name: string): Promise<Result> {
  await requireRole("admin");
  const cleanCode = cleanContentCode(code);
  if (!cleanCode) return fail("codeInvalid");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  try {
    await db.insert(contentTypes).values({ code: cleanCode, name: clean.value });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("codeTaken");
    throw error;
  }
  return done();
}

export async function setContentTypeCode(id: string, code: string): Promise<Result> {
  await requireRole("admin");
  const cleanCode = cleanContentCode(code);
  if (!cleanCode) return fail("codeInvalid");
  if (await isContentTypeInUse(id)) return fail("codeLocked"); // the code lives inside existing content IDs
  try {
    const rows = await db.update(contentTypes).set({ code: cleanCode }).where(eq(contentTypes.id, id));
    return found(rows) ? done() : fail("notFound");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("codeTaken");
    throw error;
  }
}

export async function renameContentType(id: string, name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const rows = await db.update(contentTypes).set({ name: clean.value }).where(eq(contentTypes.id, id));
  return found(rows) ? done() : fail("notFound");
}

export async function setContentTypeArchived(id: string, archived: boolean): Promise<Result> {
  await requireRole("admin");
  const rows = await db.update(contentTypes).set({ archived: !!archived }).where(eq(contentTypes.id, id));
  return found(rows) ? done() : fail("notFound");
}

/* ---------- Holidays and special events ---------- */

export async function addSpecialDay(input: { date: string; name: string; kind: string; yearly: boolean }): Promise<Result> {
  await requireRole("admin");
  if (!isIsoDate(input.date)) return fail("dateInvalid");
  const clean = cleanName(input.name);
  if (!clean.ok) return fail(clean.error);
  if (!isDayKind(input.kind)) return fail("generic");
  await db.insert(specialDays).values({ date: input.date, name: clean.value, kind: input.kind, yearly: !!input.yearly });
  return done();
}

export async function updateSpecialDay(
  id: string,
  patch: Partial<{ date: string; name: string; kind: string; yearly: boolean }>,
): Promise<Result> {
  await requireRole("admin");
  const set: Partial<typeof specialDays.$inferInsert> = {};
  if (patch.date !== undefined) {
    if (!isIsoDate(patch.date)) return fail("dateInvalid");
    set.date = patch.date;
  }
  if (patch.name !== undefined) {
    const clean = cleanName(patch.name);
    if (!clean.ok) return fail(clean.error);
    set.name = clean.value;
  }
  if (patch.kind !== undefined) {
    if (!isDayKind(patch.kind)) return fail("generic");
    set.kind = patch.kind;
  }
  if (patch.yearly !== undefined) set.yearly = !!patch.yearly;
  if (!Object.keys(set).length) return OK;
  const rows = await db.update(specialDays).set(set).where(eq(specialDays.id, id));
  return found(rows) ? done() : fail("notFound");
}

export async function deleteSpecialDay(id: string): Promise<Result> {
  await requireRole("admin");
  await db.delete(specialDays).where(eq(specialDays.id, id));
  return done();
}

