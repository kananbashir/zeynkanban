"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pushPublicKey } from "@/app/actions/notifications";
import type { Dictionary } from "@/i18n/dictionaries";
import { askedHere, isIphone, isStandalone, pushSupported, setAskedHere, subscribeHere, turnedOffHere } from "@/lib/push-client";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

type T = Dictionary["pushPrompt"];
type Mode = "ask" | "iphone" | "on";

const BELL = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";
const SHARE = "M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7";

/**
 * Phone notifications as close to "on by default" as browsers allow (a person must tap "Allow"
 * once): right after logging in, a card asks once per device; one tap on "Turn on" brings up the
 * browser's own box. "Not now" or the browser's "Block" means it never asks again on that device.
 * Where notifications are already allowed, they are switched on without asking (unless the person
 * switched them off in the bell). iPhones in Safari get the steps to add the app to the Home Screen.
 */
export function PushPrompt({ t, locale }: { t: T; locale: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const decide = async () => {
      if (!alive) return;
      // Not over another window (e.g. "What's new"): wait until it is closed.
      if (document.querySelector('[aria-modal="true"]')) return void (timer = setTimeout(decide, 1000));
      if (!pushSupported()) {
        if (isIphone() && !isStandalone() && !askedHere()) setMode("iphone");
        return;
      }
      if (Notification.permission === "denied") return;
      if (Notification.permission === "granted") {
        // Already allowed on this device: switch them on again quietly, unless turned off by hand.
        if (!turnedOffHere()) subscribeHere(await pushPublicKey(), locale).catch(() => {});
        return;
      }
      if (askedHere()) return;
      key.current = await pushPublicKey().catch(() => null); // ready before the tap (the browser's box must follow the tap at once)
      if (alive && key.current) setMode("ask");
    };
    timer = setTimeout(decide, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [locale]);

  useLayoutEffect(() => {
    if (mode && mode !== "on" && card.current && !prefersReducedMotion())
      card.current.animate([{ transform: "translateY(24px) scale(0.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, easing: springOrFallback(420, 26, 0.62) });
  }, [mode]);

  const hide = (after = 0) =>
    setTimeout(() => {
      const el = card.current;
      if (!el || prefersReducedMotion()) return setMode(null);
      el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(16px)" }], { duration: 220, easing: "ease-in", fill: "forwards" }).onfinish = () => setMode(null);
    }, after);

  const turnOn = () => {
    if (busy) return;
    setBusy(true);
    // Asked straight from the tap: some browsers (Safari) only show their box then.
    Notification.requestPermission()
      .then(async (permission) => {
        if (permission !== "granted") {
          setAskedHere(); // refused or dismissed: never ask again on this device
          return hide();
        }
        const on = key.current ? await subscribeHere(key.current, locale) : false;
        if (!on) return hide();
        setMode("on");
        hide(2200);
      })
      .catch(() => hide())
      .finally(() => setBusy(false));
  };
  const notNow = () => {
    setAskedHere();
    hide();
  };

  if (!mode) return null;
  const btn = "min-h-11 whitespace-nowrap rounded-full px-[18px] text-sm font-bold";
  return (
    <section
      ref={card}
      role="region"
      aria-label={mode === "iphone" ? t.iphoneTitle : t.title}
      className="fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-[24px] bg-ink p-4 text-surface shadow-[0_16px_40px_rgba(24,35,47,0.3)] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[390px]"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[14px] bg-sun text-on-pastel">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={mode === "on" ? "m5 12 5 5 9-10" : BELL} />
          </svg>
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <b className="text-[15.5px] font-semibold">{mode === "on" ? t.on : mode === "iphone" ? t.iphoneTitle : t.title}</b>
          {mode !== "on" && <span className="text-[13px] leading-snug opacity-80">{mode === "iphone" ? t.iphoneText : t.text}</span>}
        </div>
      </div>
      {mode === "iphone" && (
        <ol className="flex flex-col gap-2 text-[13.5px]">
          {[t.iphoneStep1, t.iphoneStep2, t.iphoneStep3].map((step, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface/15 text-xs font-extrabold">{i + 1}</span>
              {i === 0 && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={SHARE} />
                </svg>
              )}
              {step}
            </li>
          ))}
        </ol>
      )}
      {mode !== "on" && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={notNow} className={`${btn} bg-surface/12`}>
            {t.notNow}
          </button>
          {mode === "iphone" ? (
            <button type="button" onClick={notNow} className={`${btn} bg-sun text-on-pastel`}>
              {t.gotIt}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={turnOn} className={`${btn} bg-sun text-on-pastel disabled:opacity-60`}>
              {t.turnOn}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
