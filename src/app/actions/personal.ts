"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { personalTasks } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { isIsoDateString } from "@/lib/dates";
import { found } from "@/lib/users";

// Personal tasks belong to the person who is logged in, whatever their role. Every action
// works only on the caller's own rows, so nobody (an admin included) can read or change another's.

type Result = { ok: true } | { ok: false; error: ErrorKey };

function done(): Result {
  revalidatePath("/my-tasks");
  return { ok: true };
}

export async function addPersonalTask(input: { date: string; title: string; note: string }): Promise<Result> {
  const me = await requireUser();
  const title = String(input.title ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  const note = String(input.note ?? "").trim().slice(0, 500);
  if (!title) return { ok: false, error: "personalTitle" };
  if (!isIsoDateString(input.date)) return { ok: false, error: "dateInvalid" };
  await db.insert(personalTasks).values({ ownerId: me.id, title, note, dueDate: input.date });
  return done();
}

export async function setPersonalDone(id: string, isDone: boolean): Promise<Result> {
  const me = await requireUser();
  const result = await db
    .update(personalTasks)
    .set({ done: !!isDone, updatedAt: new Date() })
    .where(and(eq(personalTasks.id, id), eq(personalTasks.ownerId, me.id)));
  return found(result) ? done() : { ok: false, error: "notFound" };
}

export async function deletePersonalTask(id: string): Promise<Result> {
  const me = await requireUser();
  const result = await db.delete(personalTasks).where(and(eq(personalTasks.id, id), eq(personalTasks.ownerId, me.id)));
  return found(result) ? done() : { ok: false, error: "notFound" };
}
