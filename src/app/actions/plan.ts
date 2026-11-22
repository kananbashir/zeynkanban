"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentTypes, contents, contracts, customers, statuses, taskTypes, tasks } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireRole } from "@/lib/auth";
import { parseMonth, periodCode, suggestContentIds } from "@/lib/content-rules";
import { isIsoDateString } from "@/lib/dates";
import { isUniqueViolation } from "@/lib/users";

type Fail = { ok: false; error: ErrorKey };

/** Creates new content IDs for a contract period, continuing each type's numbering. */
export async function generateContentIds(
  customerId: string,
  contractId: string,
  counts: { contentTypeId: string; count: number }[],
): Promise<{ ok: true; created: { id: string; code: string; contentTypeId: string }[] } | Fail> {
  await requireRole("admin", "manager");
  const [customer] = await db.select({ shortName: customers.shortName }).from(customers).where(eq(customers.id, customerId));
  const [contract] = await db
    .select({ start: contracts.startMonth, end: contracts.endMonth })
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.customerId, customerId)));
  if (!customer || !contract) return { ok: false, error: "notFound" };
  const wanted = counts.filter((c) => Number.isInteger(c.count) && c.count > 0 && c.count <= 50);
  if (!wanted.length) return { ok: true, created: [] };
  const types = await db
    .select({ id: contentTypes.id, code: contentTypes.code, archived: contentTypes.archived })
    .from(contentTypes)
    .where(inArray(contentTypes.id, wanted.map((w) => w.contentTypeId)));
  if (types.some((t) => t.archived) || types.length !== wanted.length) return { ok: false, error: "typeArchived" };
  const period = periodCode(parseMonth(contract.start)!, parseMonth(contract.end)!);

  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = (await db.select({ code: contents.code }).from(contents).where(eq(contents.customerId, customerId))).map((c) => c.code);
    const rows = wanted.flatMap((w) => {
      const type = types.find((t) => t.id === w.contentTypeId)!;
      return suggestContentIds(customer.shortName, type.code, period, existing, w.count).map((code) => ({ id: randomUUID(), code, customerId, contentTypeId: type.id, contractId }));
    });
    try {
      await db.insert(contents).values(rows);
      revalidatePath("/customers", "layout");
      return { ok: true, created: rows.map(({ id, code, contentTypeId }) => ({ id, code, contentTypeId })) };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // someone added an ID at the same moment: recount and retry
    }
  }
  return { ok: false, error: "contentIdTaken" };
}

/**
 * Saves a month plan: one "Post publishing" draft (nobody on it yet) per content ID on its chosen day.
 * Content IDs that already have a publishing task are skipped.
 */
export async function savePublishingPlan(customerId: string, items: { contentId: string; date: string }[]): Promise<{ ok: true; created: number } | Fail> {
  const me = await requireRole("admin", "manager");
  if (!items.length) return { ok: true, created: 0 };
  if (items.some((i) => !isIsoDateString(i.date))) return { ok: false, error: "dateInvalid" };
  const [type] = await db
    .select({ id: taskTypes.id })
    .from(taskTypes)
    .where(and(eq(taskTypes.isPublishing, true), isNull(taskTypes.deletedAt)))
    .limit(1);
  if (!type) return { ok: false, error: "publishingType" };
  const [first] = await db.select({ id: statuses.id }).from(statuses).where(isNull(statuses.deletedAt)).orderBy(asc(statuses.position)).limit(1);
  if (!first) return { ok: false, error: "lastStatus" };

  const ids = [...new Set(items.map((i) => i.contentId))];
  const own = await db
    .select({ id: contents.id })
    .from(contents)
    .where(and(inArray(contents.id, ids), eq(contents.customerId, customerId), eq(contents.archived, false)));
  if (own.length !== ids.length) return { ok: false, error: "contentRequired" };
  const planned = new Set(
    (
      await db
        .select({ contentId: tasks.contentId })
        .from(tasks)
        .innerJoin(taskTypes, eq(taskTypes.id, tasks.taskTypeId))
        .where(and(inArray(tasks.contentId, ids), eq(taskTypes.isPublishing, true), eq(tasks.archived, false)))
    ).map((r) => r.contentId),
  );
  const rows = items
    .filter((i, index) => !planned.has(i.contentId) && items.findIndex((x) => x.contentId === i.contentId) === index)
    .map((i) => ({ customerId, contentId: i.contentId, taskTypeId: type.id, statusId: first.id, dueDate: i.date, note: "", createdBy: me.id }));
  if (rows.length) await db.insert(tasks).values(rows);
  revalidatePath("/", "layout");
  return { ok: true, created: rows.length };
}
