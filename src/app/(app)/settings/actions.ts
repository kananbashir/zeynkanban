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
import { decryptCode } from "@/lib/codes";
import { DEFAULT_TASK_ICON, isTaskIcon } from "@/lib/task-icons";
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
  const code = await replaceCode(id, async (stored) => {
    const rows = await db.update(users).set({ ...stored, updatedAt: new Date() }).where(eq(users.id, id));
    return found(rows);
  });
  if (!code) return fail("notFound");
  await endSessionsOf(id); // the old code, and everyone logged in with it, stops working
  revalidatePath("/settings");
  return { ok: true, code };
}

/** Shows a person's current code to an admin (from its encrypted copy). */
export async function revealUserCode(id: string): Promise<Result & { code?: string }> {
  await requireRole("admin");
  const [user] = await db.select({ codeSecret: users.codeSecret }).from(users).where(eq(users.id, id));
  if (!user) return fail("notFound");
  const code = decryptCode(user.codeSecret);
  return code ? { ok: true, code } : fail("codeUnknown");
}

/* ---------- Statuses ---------- */

async function liveStatuses() {
  return db
    .select({ id: statuses.id, isFinished: statuses.isFinished, color: statuses.color })
    .from(statuses)
    .where(isNull(statuses.deletedAt))
    .orderBy(asc(statuses.position));
}

/** An English name: empty means "use the Azerbaijani one". */
function cleanNameEn(input: unknown): { ok: true; value: string | null } | { ok: false; error: ErrorKey } {
  const value = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { ok: true, value: null };
  const clean = cleanName(value);
  return clean;
}

export async function addStatus(name: string, nameEn = ""): Promise<Result & { id?: string; color?: string; name?: string; nameEn?: string | null }> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const en = cleanNameEn(nameEn);
  if (!en.ok) return fail(en.error);
  const live = await liveStatuses();
  const id = crypto.randomUUID();
  const color = nextStatusColor(live.map((s) => s.color));
  await db.insert(statuses).values({ id, name: clean.value, nameEn: en.value, color, position: live.length });
  revalidatePath("/settings");
  return { ok: true, id, color, name: clean.value, nameEn: en.value };
}

/** Puts back these items (just deleted, brought back by Undo) at their old places in the order. */
async function putBack(table: typeof statuses | typeof taskTypes, live: { id: string }[], id: string, index: number) {
  const ids = live.map((x) => x.id).filter((x) => x !== id);
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
  await db.transaction(async (tx) => {
    await tx.update(table).set({ deletedAt: null }).where(eq(table.id, id));
    for (const [position, x] of ids.entries()) await tx.update(table).set({ position }).where(eq(table.id, x));
  });
}

/** Undo for a deleted status: it comes back at its place. */
export async function restoreStatus(id: string, index: number): Promise<Result> {
  await requireRole("admin");
  const [row] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.id, id));
  if (!row) return fail("notFound");
  await putBack(statuses, await liveStatuses(), id, index);
  return done();
}

export async function renameStatus(id: string, name: string): Promise<Result> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const rows = await db.update(statuses).set({ name: clean.value }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

export async function renameStatusEn(id: string, nameEn: string): Promise<Result> {
  await requireRole("admin");
  const en = cleanNameEn(nameEn);
  if (!en.ok) return fail(en.error);
  const rows = await db.update(statuses).set({ nameEn: en.value }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
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
  // A status means one thing: finished, cancelled or postponed.
  const rows = await db.update(statuses).set(finished ? { isFinished: true, isCancelled: false, isPostponed: false } : { isFinished: false }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

/** Marks a status as meaning "cancelled" or "postponed" (or not). It then stops counting as finished or as the other one. */
async function setStatusMeaning(id: string, meaning: "isCancelled" | "isPostponed", on: boolean): Promise<Result> {
  await requireRole("admin");
  const live = await liveStatuses();
  if (on && live.find((x) => x.id === id)?.isFinished) {
    const problem = unfinishProblem(live, id); // at least one status must still count as finished
    if (problem) return fail(problem);
  }
  const set = on ? { isFinished: false, isCancelled: meaning === "isCancelled", isPostponed: meaning === "isPostponed" } : { [meaning]: false };
  const rows = await db.update(statuses).set(set).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}
export async function setStatusCancelled(id: string, on: boolean): Promise<Result> {
  return setStatusMeaning(id, "isCancelled", on);
}
export async function setStatusPostponed(id: string, on: boolean): Promise<Result> {
  return setStatusMeaning(id, "isPostponed", on);
}

export async function setStatusReview(id: string, on: boolean): Promise<Result> {
  await requireRole("admin");
  const rows = await db.update(statuses).set({ notifyReview: !!on }).where(and(eq(statuses.id, id), isNull(statuses.deletedAt)));
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
    .where(and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false)))
    .orderBy(asc(taskTypes.position));
}

export async function addTaskType(name: string, nameEn = "", icon: string = DEFAULT_TASK_ICON): Promise<Result & { id?: string }> {
  await requireRole("admin");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const en = cleanNameEn(nameEn);
  if (!en.ok) return fail(en.error);
  const live = await liveTaskTypes();
  const id = crypto.randomUUID();
  await db.insert(taskTypes).values({ id, name: clean.value, nameEn: en.value, position: live.length, icon: isTaskIcon(icon) ? icon : DEFAULT_TASK_ICON });
  revalidatePath("/settings");
  return { ok: true, id };
}

/** The icon shown before a task type's name on task cards. */
export async function setTaskTypeIcon(id: string, icon: string): Promise<Result> {
  await requireRole("admin");
  if (!isTaskIcon(icon)) return fail("notFound");
  const rows = await db.update(taskTypes).set({ icon }).where(and(eq(taskTypes.id, id), isNull(taskTypes.deletedAt)));
  return found(rows) ? done() : fail("notFound");
}

export async function renameTaskTypeEn(id: string, nameEn: string): Promise<Result> {
  await requireRole("admin");
  const en = cleanNameEn(nameEn);
  if (!en.ok) return fail(en.error);
  const rows = await db.update(taskTypes).set({ nameEn: en.value }).where(and(eq(taskTypes.id, id), isNull(taskTypes.deletedAt)));
  return found(rows) ? done() : fail("notFound");
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

/** Undo for a deleted task type: it comes back at its place. */
export async function restoreTaskType(id: string, index: number): Promise<Result> {
  await requireRole("admin");
  const [row] = await db.select({ id: taskTypes.id }).from(taskTypes).where(and(eq(taskTypes.id, id), eq(taskTypes.oneOff, false)));
  if (!row) return fail("notFound");
  await putBack(taskTypes, await liveTaskTypes(), id, index);
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

export async function addContentType(code: string, name: string): Promise<Result & { id?: string; code?: string; name?: string }> {
  await requireRole("admin");
  const cleanCode = cleanContentCode(code);
  if (!cleanCode) return fail("codeInvalid");
  const clean = cleanName(name);
  if (!clean.ok) return fail(clean.error);
  const id = crypto.randomUUID();
  try {
    await db.insert(contentTypes).values({ id, code: cleanCode, name: clean.value });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("codeTaken");
    throw error;
  }
  revalidatePath("/settings");
  return { ok: true, id, code: cleanCode, name: clean.value };
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

/** Adds a holiday or special event. With `id`: puts back one just removed (Undo). */
export async function addSpecialDay(input: { id?: string; date: string; name: string; nameEn?: string | null; kind: string; yearly: boolean }): Promise<Result & { id?: string; name?: string; nameEn?: string | null }> {
  await requireRole("admin");
  if (!isIsoDate(input.date)) return fail("dateInvalid");
  const clean = cleanName(input.name);
  if (!clean.ok) return fail(clean.error);
  const en = cleanNameEn(input.nameEn);
  if (!en.ok) return fail(en.error);
  if (!isDayKind(input.kind)) return fail("generic");
  const id = input.id && /^[0-9a-f-]{36}$/.test(input.id) ? input.id : crypto.randomUUID();
  try {
    await db.insert(specialDays).values({ id, date: input.date, name: clean.value, nameEn: en.value, kind: input.kind, yearly: !!input.yearly });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("notFound");
    throw error;
  }
  revalidatePath("/settings");
  return { ok: true, id, name: clean.value, nameEn: en.value };
}

export async function updateSpecialDay(
  id: string,
  patch: Partial<{ date: string; name: string; nameEn: string | null; kind: string; yearly: boolean }>,
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
  if (patch.nameEn !== undefined) {
    const en = cleanNameEn(patch.nameEn);
    if (!en.ok) return fail(en.error);
    set.nameEn = en.value;
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

