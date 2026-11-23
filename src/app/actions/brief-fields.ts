"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { briefFields } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole } from "@/lib/auth";
import { BRIEF_LIMITS, cleanTemplateField, type BriefTemplateField } from "@/lib/brief-rules";

// Settings → Content brief: the fields every new brief starts with. Admins only.

type Fail = { ok: false; error: ErrorKey };

const all = () =>
  db
    .select({ id: briefFields.id, label: briefFields.label, labelEn: briefFields.labelEn, type: briefFields.type, hint: briefFields.hint, hintEn: briefFields.hintEn, visible: briefFields.visible })
    .from(briefFields)
    .orderBy(asc(briefFields.position), asc(briefFields.createdAt));

/** Numbers the fields 0, 1, 2… in the given order. */
async function renumber(ids: string[]) {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) await tx.update(briefFields).set({ position }).where(eq(briefFields.id, id));
  });
}

export async function addBriefField(input: { label: string; labelEn?: string; type: string; hint?: string; hintEn?: string }): Promise<{ ok: true; field: BriefTemplateField } | Fail> {
  await requireRole("admin");
  const clean = cleanTemplateField(input);
  if (!clean.ok) return { ok: false, error: clean.error };
  const list = await all();
  if (list.length >= BRIEF_LIMITS.template) return { ok: false, error: "briefTooMany" };
  const id = crypto.randomUUID();
  await db.insert(briefFields).values({ id, position: list.length, ...clean.value, visible: true });
  revalidatePath("/settings");
  return { ok: true, field: { id, ...clean.value, visible: true } };
}

export async function updateBriefField(id: string, patch: Partial<Omit<BriefTemplateField, "id">>): Promise<{ ok: true } | Fail> {
  await requireRole("admin");
  const [field] = await db.select().from(briefFields).where(eq(briefFields.id, id));
  if (!field) return { ok: false, error: "notFound" };
  const clean = cleanTemplateField({ ...field, ...patch });
  if (!clean.ok) return { ok: false, error: clean.error };
  await db.update(briefFields).set({ ...clean.value, visible: patch.visible ?? field.visible }).where(eq(briefFields.id, id));
  revalidatePath("/settings");
  return { ok: true };
}

/** Removes a field; the answer carries it (and where it was), so Undo can put it back. */
export async function removeBriefField(id: string): Promise<{ ok: true; field: BriefTemplateField; index: number } | Fail> {
  await requireRole("admin");
  const list = await all();
  const index = list.findIndex((f) => f.id === id);
  if (index < 0) return { ok: false, error: "notFound" };
  await db.delete(briefFields).where(eq(briefFields.id, id));
  await renumber(list.filter((f) => f.id !== id).map((f) => f.id));
  revalidatePath("/settings");
  return { ok: true, field: list[index], index };
}

/** Undo: puts a removed field back where it was. */
export async function restoreBriefField(field: BriefTemplateField, index: number): Promise<{ ok: true } | Fail> {
  await requireRole("admin");
  const clean = cleanTemplateField(field);
  if (!clean.ok) return { ok: false, error: clean.error };
  const list = await all();
  if (list.some((f) => f.id === field.id)) return { ok: true };
  if (list.length >= BRIEF_LIMITS.template) return { ok: false, error: "briefTooMany" };
  await db.insert(briefFields).values({ id: field.id, position: 0, ...clean.value, visible: !!field.visible });
  const ids = list.map((f) => f.id);
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, field.id);
  await renumber(ids);
  revalidatePath("/settings");
  return { ok: true };
}

export async function reorderBriefFields(ids: string[]): Promise<{ ok: true } | Fail> {
  await requireRole("admin");
  const known = new Set((await all()).map((f) => f.id));
  const order = ids.filter((id) => known.has(id));
  if (order.length !== known.size) return { ok: false, error: "notFound" };
  await renumber(order);
  revalidatePath("/settings");
  return { ok: true };
}
