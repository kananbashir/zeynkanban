import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { appValues, contents, customers, notificationPrefs, notifications, pushSubscriptions, taskTypes, tasks, users, type NotificationKind } from "@/db/schema";
import { dictionaries, type Locale } from "@/i18n/dictionaries";
import { assigneesColumn, parseAssignees, type Person } from "./assignees";
import { todayIso } from "./dates";
import { taskEndColumn } from "./task-end";
import { notificationText, PREF_OF, type NotificationData, type TaskRef } from "./notification-text";
import { isStaff } from "./roles";

type Row = { id: string; userId: string; data: NotificationData };

/** The facts about a task that a notification repeats (so it reads right even if the task changes later). */
export async function taskRef(taskId: string): Promise<(TaskRef & { assignees: Person[] }) | null> {
  const [row] = await db
    .select({
      taskId: tasks.id,
      type: taskTypes.name,
      typeEn: taskTypes.nameEn,
      code: contents.code,
      customer: customers.name,
      customerId: customers.id,
      // When it is due: its deadline, or its own day without one.
      due: taskEndColumn,
      assignees: assigneesColumn,
    })
    .from(tasks)
    .innerJoin(taskTypes, eq(taskTypes.id, tasks.taskTypeId))
    .innerJoin(contents, eq(contents.id, tasks.contentId))
    .innerJoin(customers, eq(customers.id, tasks.customerId))
    .where(eq(tasks.id, taskId));
  if (!row) return null;
  const { typeEn, assignees, ...rest } = row;
  return { ...rest, ...(typeEn ? { typeEn } : {}), assignees: parseAssignees(assignees) };
}

/** A task's facts for a notification, without who is on it. */
export const refOnly = <T extends TaskRef>({ taskId, type, typeEn, code, customer, customerId, due }: T): TaskRef => ({ taskId, type, ...(typeEn ? { typeEn } : {}), code, customer, customerId, due });

/** Active admins and managers, the people told about reviews and overdue tasks. */
export async function staffIds(except?: string): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.active, true), inArray(users.role, ["admin", "manager"])));
  return rows.map((r) => r.id).filter((id) => id !== except);
}

/**
 * Stores a notification for each person who wants this kind, and returns what was stored
 * so that phone pushes can be sent once the page has answered (see deliverPush).
 */
export async function notify(userIds: string[], kind: NotificationKind, data: NotificationData, taskId: string | null = null): Promise<Row[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return [];
  const pref = PREF_OF[kind];
  const people = await db
    .select({ id: users.id, off: sql<number>`coalesce(${notificationPrefs[pref]}, 1) = 0`.mapWith(Number) })
    .from(users)
    .leftJoin(notificationPrefs, eq(notificationPrefs.userId, users.id))
    .where(and(inArray(users.id, ids), eq(users.active, true)));
  const rows = people.filter((p) => !p.off).map((p) => ({ id: crypto.randomUUID(), userId: p.id, data }));
  if (rows.length) await db.insert(notifications).values(rows.map((r) => ({ id: r.id, userId: r.userId, kind, taskId, data: JSON.stringify(r.data) })));
  return rows;
}

/* ---------- Phone push ---------- */

let vapid: { publicKey: string; privateKey: string } | null = null;

/**
 * The key pair that signs pushes. Taken from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY when set;
 * otherwise made once and kept in the database, so the hosting needs no extra setup.
 */
export async function vapidKeys() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return vapid;
  }
  const read = async () => (await db.select({ value: appValues.value }).from(appValues).where(eq(appValues.key, "vapid")))[0]?.value;
  let value = await read();
  if (!value) {
    const fresh = webpush.generateVAPIDKeys();
    await db.insert(appValues).values({ key: "vapid", value: JSON.stringify(fresh) }).onDuplicateKeyUpdate({ set: { key: sql`${appValues.key}` } });
    value = await read(); // another request may have made one at the same moment; use whichever was saved
  }
  vapid = JSON.parse(value!);
  return vapid!;
}

export const endpointHash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

/** Sends each stored notification to the person's subscribed devices. Dead subscriptions are removed. */
export async function deliverPush(rows: Row[]) {
  if (!rows.length) return;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, [...new Set(rows.map((r) => r.userId))]));
  if (!subs.length) return;
  const roles = new Map((await db.select({ id: users.id, role: users.role }).from(users).where(inArray(users.id, [...new Set(subs.map((s) => s.userId))]))).map((u) => [u.id, u.role]));
  const keys = await vapidKeys();
  const subject = process.env.VAPID_SUBJECT || "https://project.zeynmedia.az";
  const today = todayIso();
  const unread = new Map<string, number>();
  for (const id of new Set(subs.map((s) => s.userId))) {
    const [c] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(notifications).where(and(eq(notifications.userId, id), isNull(notifications.readAt)));
    unread.set(id, c?.n ?? 0);
  }
  await Promise.all(
    rows.flatMap((row) =>
      subs
        .filter((s) => s.userId === row.userId)
        .map(async (s) => {
          const t = dictionaries[(s.locale as Locale) in dictionaries ? (s.locale as Locale) : "az"];
          const text = notificationText(row.data, isStaff(roles.get(s.userId) ?? ""), today, t.notifications, t.tasks, s.locale as Locale);
          const payload = JSON.stringify({ title: text.title, body: [text.a, text.b].filter(Boolean).join("\n"), url: text.href, tag: row.id, badge: unread.get(s.userId) ?? 0 });
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
              TTL: 60 * 60 * 12,
              // Delivered at once even when the phone is idle (otherwise Android may hold it back for minutes).
              urgency: "high",
            });
          } catch (error) {
            const code = (error as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
            else console.error("push failed", code ?? error);
          }
        }),
    ),
  );
}

/** Removes notifications older than 90 days. */
export async function pruneNotifications() {
  await db.delete(notifications).where(lt(notifications.createdAt, new Date(Date.now() - 90 * 24 * 3600 * 1000)));
}
