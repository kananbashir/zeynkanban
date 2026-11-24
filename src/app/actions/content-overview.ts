"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contents, contentTypes, contracts, customers } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { formatPeriod, parseMonth } from "@/lib/content-rules";
import { todayIso } from "@/lib/dates";
import { tasksOfContent, type TaskView } from "@/lib/tasks";

export type ContentOverview = {
  contentId: string;
  code: string;
  customerId: string;
  customerName: string;
  typeName: string;
  /** The contract period, e.g. "November – December 2026". */
  period: string | null;
  /** The day of its (unarchived) publishing task. */
  publishDate: string | null;
  note: string | null;
  hasBrief: boolean;
  hasFinishedWork: boolean;
  today: string;
  tasks: TaskView[];
  /** Admins and managers may add a task to it (and open any of its tasks on the customer page). */
  canAdd: boolean;
  /** Who is looking: an employee can open only their own tasks (in My tasks). */
  viewerId: string;
};

/**
 * Everything about a content ID for its window: details, note, and all its tasks in date order.
 * Admins and managers see any; others only content IDs they have a task on (read-only).
 */
export async function loadContentOverview(contentId: string): Promise<{ ok: true; overview: ContentOverview } | { ok: false; error: ErrorKey }> {
  const me = await requireUser();
  const [row] = await db
    .select({ code: contents.code, customerId: contents.customerId, customerName: customers.name, typeName: contentTypes.name, start: contracts.startMonth, end: contracts.endMonth, note: contents.note })
    .from(contents)
    .innerJoin(customers, eq(customers.id, contents.customerId))
    .innerJoin(contentTypes, eq(contentTypes.id, contents.contentTypeId))
    .leftJoin(contracts, eq(contracts.id, contents.contractId))
    .where(eq(contents.id, contentId));
  if (!row) return { ok: false, error: "notFound" };
  const all = await tasksOfContent(contentId);
  const staff = me.role !== "employee";
  if (!staff && !all.some((x) => !x.archived && x.assignees.some((p) => p.id === me.id))) return { ok: false, error: "notAllowed" };
  const { t } = await getDictionary();
  const start = row.start ? parseMonth(row.start) : null;
  const end = row.end ? parseMonth(row.end) : null;
  const live = all.filter((x) => !x.archived);
  return {
    ok: true,
    overview: {
      contentId,
      code: row.code,
      customerId: row.customerId,
      customerName: row.customerName,
      typeName: row.typeName,
      period: start && end ? formatPeriod(start, end, t.customers.months) : null,
      publishDate: live.find((x) => x.isPublishing)?.dueDate ?? null,
      note: row.note,
      hasBrief: all[0]?.hasBrief ?? false,
      hasFinishedWork: all[0]?.hasFinishedWork ?? false,
      today: todayIso(),
      tasks: all,
      canAdd: staff,
      viewerId: me.id,
    },
  };
}
