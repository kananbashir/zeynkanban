"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  loadNotifications,
  markAllRead,
  markRead,
  removePushSubscription,
  savePushSubscription,
  setPref,
  unreadCount,
  type NotificationItem,
} from "@/app/actions/notifications";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import type { IconKind, PrefKey } from "@/lib/notification-text";
import { Icon } from "./icons";
import { SegmentedControl } from "./motion";

type T = Dictionary["notifications"];
type Loaded = Awaited<ReturnType<typeof loadNotifications>>;
type PushState = "unknown" | "on" | "off" | "blocked" | "unsupported" | "busy";

const ICONS: Record<IconKind, string> = {
  assigned: "M6.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6",
  changed: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
  review: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  overdue: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8v5M12 16.5v.01",
  summary: "M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4",
  moved: "M7 7h13l-3-3M17 17H4l3 3",
  status: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  reminder: "M12 7v5l3 2M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
};
const TINTS: Record<IconKind, [string, string]> = {
  assigned: ["#d9f0ee", "#0a5e5b"],
  changed: ["#c6e9f7", "#18232f"],
  review: ["#f8dfc4", "#18232f"],
  overdue: ["#fbe0dd", "#b3261e"],
  summary: ["#fff3cc", "#18232f"],
  moved: ["#d2cbf6", "#18232f"],
  status: ["#edf6f4", "#0a5e5b"],
  reminder: ["#fff3cc", "#5c4300"],
};

const svg = (d: string, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    <path d={d} />
  </svg>
);

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIphone = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

/** The bell in the top bar: unread count, the notification list, and the person's notification settings. */
export function NotificationBell({ initialUnread, locale, t }: { initialUnread: number; locale: Locale; t: T }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "prefs">("list");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [unread, setUnread] = useState(initialUnread);
  const [data, setData] = useState<Loaded | null>(null);
  const [push, setPush] = useState<PushState>("unknown");

  const reload = useCallback(async () => {
    const next = await loadNotifications();
    setData(next);
    setUnread(next.unread);
  }, []);

  // Check for new notifications every minute and whenever the page comes back into view.
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      unreadCount()
        .then((n) => alive && setUnread(n))
        .catch(() => {});
    };
    const timer = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (unread) nav.setAppBadge?.(unread).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function detectPush() {
    if (!pushSupported()) return setPush("unsupported");
    if (Notification.permission === "denied") return setPush("blocked");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setPush(sub && Notification.permission === "granted" ? "on" : "off");
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setView("list");
    if (next) {
      reload().catch(() => {});
      detectPush().catch(() => setPush("unsupported"));
    }
  }

  async function togglePush() {
    if (!data || push === "busy" || push === "unsupported") return;
    const was = push;
    setPush("busy");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      if (was === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        return setPush("off");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPush(permission === "denied" ? "blocked" : "off");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      setPush((await savePushSubscription(json, locale)) ? "on" : "off");
    } catch {
      setPush("off");
      alert(t.pushFailed);
    }
  }

  function openItem(item: NotificationItem) {
    if (item.unread) {
      setUnread((n) => Math.max(0, n - 1));
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, unread: false } : x)) });
      markRead(item.id).catch(() => {});
    }
    setOpen(false);
    router.push(item.href);
  }

  function readAll() {
    setUnread(0);
    setData((d) => d && { ...d, items: d.items.map((x) => ({ ...x, unread: false })) });
    markAllRead().catch(() => {});
  }

  function togglePref(key: PrefKey) {
    if (!data) return;
    const on = !data.prefs[key];
    setData({ ...data, prefs: { ...data.prefs, [key]: on } });
    setPref(key, on).catch(() => {});
  }

  const items = (data?.items ?? []).filter((x) => filter === "all" || x.unread);
  const groups = [
    { label: t.today, list: items.filter((x) => x.today) },
    { label: t.earlier, list: items.filter((x) => !x.today) },
  ].filter((g) => g.list.length);
  const label = unread ? fill(t.bellNew, { n: unread }) : t.title;

  const toggle = (on: boolean) => (
    <span className={`flex h-7 w-[46px] shrink-0 rounded-full p-[3px] transition-colors duration-200 ${on ? "bg-teal" : "bg-[#6b7785]"}`}>
      <span className={`size-[22px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${on ? "translate-x-[18px]" : ""}`} />
    </span>
  );

  const pushText =
    push === "unsupported" ? (isIphone() ? t.pushIphone : t.pushUnsupported) : push === "blocked" ? t.pushBlocked : push === "on" ? t.pushOn : t.pushOff;

  return (
    <div className="relative">
      <button type="button" aria-label={label} title={label} aria-expanded={open} onClick={toggleOpen} className="relative flex size-[52px] items-center justify-center rounded-full bg-white text-ink">
        <Icon name="bell" />
        {unread > 0 && (
          <span key={unread} className="zk-pop absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sun px-[5px] text-[11px] font-bold text-ink">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button type="button" aria-label={t.close} tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-[24] cursor-default" />
          <section
            role="dialog"
            aria-label={view === "prefs" ? t.settings : t.title}
            className="zk-fade-up fixed inset-x-2 top-2 z-[25] flex max-h-[calc(100dvh-16px)] flex-col overflow-hidden rounded-[24px] bg-white text-left shadow-[0_20px_56px_rgba(24,35,47,0.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[62px] sm:w-[420px]"
          >
            <div className="flex flex-col gap-3 pb-3 pl-[18px] pr-3.5 pt-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{view === "prefs" ? t.settings : t.title}</h2>
                {view === "list" && unread > 0 && <span className="rounded-full bg-sun px-[9px] py-[3px] text-xs font-bold">{fill(t.newN, { n: unread })}</span>}
                <button
                  type="button"
                  aria-label={view === "prefs" ? t.back : t.settings}
                  title={view === "prefs" ? t.back : t.settings}
                  aria-pressed={view === "prefs"}
                  onClick={() => setView(view === "prefs" ? "list" : "prefs")}
                  className={`ml-auto flex size-10 items-center justify-center rounded-full transition-colors ${view === "prefs" ? "bg-teal text-white" : "bg-mint text-ink"}`}
                >
                  {svg("M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M14 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M6 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0", 16)}
                </button>
                <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-full bg-mint">
                  {svg("M6 6l12 12M18 6 6 18", 16)}
                </button>
              </div>
              {view === "list" && (
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    label={t.show}
                    value={filter}
                    onChange={(k) => setFilter(k as "all" | "unread")}
                    itemClassName="min-h-9 px-3.5 text-[13px]"
                    items={[
                      { key: "all", label: t.all },
                      { key: "unread", label: t.unread },
                    ]}
                  />
                  {unread > 0 && (
                    <button type="button" onClick={readAll} className="ml-auto min-h-9 px-1.5 text-[13px] font-semibold text-teal-deep underline">
                      {t.markAll}
                    </button>
                  )}
                </div>
              )}
            </div>

            {view === "list" ? (
              <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-2.5">
                {groups.map((g) => (
                  <div key={g.label} className="flex flex-col gap-0.5">
                    <span className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">{g.label}</span>
                    {g.list.map((n) => (
                      <button key={n.id} type="button" onClick={() => openItem(n)} className={`flex items-start gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-mint ${n.unread ? "bg-[#f4f9f8]" : ""}`}>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: TINTS[n.icon][0], color: TINTS[n.icon][1] }}>
                          {svg(ICONS[n.icon])}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={`text-sm leading-snug ${n.unread ? "font-bold" : "font-medium"}`}>{n.title}</span>
                          <span className="text-[13px] leading-snug [overflow-wrap:anywhere]">{n.a}</span>
                          {n.b && <span className="text-xs leading-snug text-muted">{n.b}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="whitespace-nowrap text-xs text-muted">{n.time}</span>
                          {n.unread && <span aria-label={t.unreadDot} className="size-[9px] rounded-full bg-teal" />}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {data && groups.length === 0 && <p className="px-4 py-9 text-center text-sm text-muted">{filter === "unread" ? t.emptyUnread : t.emptyAll}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-3.5 overflow-y-auto px-[18px] pb-[18px]">
                <div className="flex flex-col gap-2 rounded-[18px] bg-mint px-3.5 py-3">
                  <button type="button" aria-pressed={push === "on"} disabled={push === "unsupported" || push === "busy" || push === "unknown"} onClick={togglePush} className="flex min-h-11 items-center gap-3 text-left disabled:opacity-60">
                    <span className="flex-1 text-sm font-semibold">{t.pushTitle}</span>
                    {toggle(push === "on")}
                  </button>
                  <span className="text-xs leading-normal text-ink-soft">{pushText}</span>
                  {push !== "unsupported" && isIphone() && push !== "on" && <span className="text-xs leading-normal text-ink-soft">{t.pushIphone}</span>}
                </div>
                <span className="text-[13px] font-semibold">{t.about}</span>
                <div className="flex flex-col gap-1">
                  {(data?.prefKeys ?? []).map((key) => (
                    <button key={key} type="button" aria-pressed={data!.prefs[key]} onClick={() => togglePref(key)} className="flex min-h-12 items-center gap-3 rounded-[14px] py-1.5 text-left">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{t.prefs[key][0]}</span>
                        <span className="text-xs text-muted">{t.prefs[key][1]}</span>
                      </span>
                      {toggle(data!.prefs[key])}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
