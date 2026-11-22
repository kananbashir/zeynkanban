"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationPrefs, notifications, pushSubscriptions } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { LOCALES, type Locale } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { dateInZone, todayIso } from "@/lib/dates";
import { endpointHash, vapidKeys } from "@/lib/notify";
import { notificationText, notificationTime, OWN_PREFS, STAFF_PREFS, type IconKind, type NotificationData, type PrefKey } from "@/lib/notification-text";

export type NotificationItem = { id: string; title: string; a: string; b: string; href: string; icon: IconKind; time: string; today: boolean; unread: boolean };

/** Only the caller's own notifications, written in the site's current language. */
export async function loadNotifications(): Promise<{ unread: number; items: NotificationItem[]; prefs: Record<PrefKey, boolean>; prefKeys: PrefKey[]; publicKey: string }> {
  const me = await requireUser();
  const { t } = await getDictionary();
  const staff = me.role !== "employee";
  const rows = await db.select().from(notifications).where(eq(notifications.userId, me.id)).orderBy(desc(notifications.createdAt)).limit(60);
  const now = new Date();
  const today = todayIso();
  const items = rows.map((r) => {
    const text = notificationText(JSON.parse(r.data) as NotificationData, staff, today, t.notifications, t.tasks);
    return { id: r.id, ...text, time: notificationTime(r.createdAt, now, t.notifications, t.tasks), today: dateInZone(r.createdAt) === today, unread: !r.readAt };
  });
  const [prefRow] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, me.id));
  const prefKeys = staff ? STAFF_PREFS : OWN_PREFS;
  const prefs = Object.fromEntries(STAFF_PREFS.map((k) => [k, prefRow ? prefRow[k] : true])) as Record<PrefKey, boolean>;
  return { unread: await unreadCount(), items, prefs, prefKeys, publicKey: (await vapidKeys()).publicKey };
}

export async function unreadCount(): Promise<number> {
  const me = await requireUser();
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const me = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, me.id), isNull(notifications.readAt)));
}

export async function markAllRead(): Promise<void> {
  const me = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, me.id), isNull(notifications.readAt)));
}

export async function setPref(key: PrefKey, on: boolean): Promise<void> {
  const me = await requireUser();
  if (!STAFF_PREFS.includes(key)) return;
  await db
    .insert(notificationPrefs)
    .values({ userId: me.id, [key]: !!on })
    .onDuplicateKeyUpdate({ set: { [key]: !!on } });
}

/** Saves this browser's push subscription for the person logged in (moving it if someone else had it). */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, locale: string): Promise<boolean> {
  const me = await requireUser();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  const lang: Locale = (LOCALES as readonly string[]).includes(locale) ? (locale as Locale) : "az";
  const hash = endpointHash(sub.endpoint);
  await db
    .insert(pushSubscriptions)
    .values({ userId: me.id, endpointHash: hash, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, locale: lang })
    .onDuplicateKeyUpdate({ set: { userId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, locale: lang } });
  return true;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const me = await requireUser();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpointHash, endpointHash(String(endpoint))), eq(pushSubscriptions.userId, me.id)));
}
