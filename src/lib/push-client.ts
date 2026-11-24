// Phone notifications (Web Push) in the browser: shared by the bell's switch and the
// "Turn on notifications?" card. Browser-only.
import { savePushSubscription } from "@/app/actions/notifications";

/** The device remembers: the person turned notifications off here (don't switch them back on by ourselves). */
const OFF_KEY = "zk-push-off";
/** The device remembers: the card was answered with "Not now" or the browser's "Block" (never ask again). */
const ASKED_KEY = "zk-push-asked";

const read = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const write = (key: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {}
};

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIphone = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
/** Opened from the Home Screen (as an app), where an iPhone can receive notifications. */
export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const turnedOffHere = () => read(OFF_KEY);
export const setTurnedOffHere = (off: boolean) => write(OFF_KEY, off);
export const askedHere = () => read(ASKED_KEY);
export const setAskedHere = () => write(ASKED_KEY, true);

export function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Subscribes this browser (permission must already be granted) and saves it for the person logged
 * in. Returns whether phone notifications are now on for this device.
 */
export async function subscribeHere(publicKey: string, locale: string): Promise<boolean> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const saved = await savePushSubscription(json, locale);
  if (saved) setTurnedOffHere(false);
  return saved;
}
