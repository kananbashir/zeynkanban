"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { nudgeTask } from "@/app/actions/tasks";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { dateInZone, daysBetween } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import type { TaskView } from "@/lib/tasks";
import { personColor } from "./avatar-group";
import { Toast, useToast } from "./toast";
import { initials } from "./top-bar";

const BELL = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";
const CHECK = "m5 12 5 5L20 7";
const SEND = "m22 2-7 20-4-9-9-4zM22 2 11 13";
/** How long the bell stays a ✓ after a reminder (the server allows one a minute). */
const SENT_MS = 60_000;

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** "just now", "5 min ago", "today 16:40", "yesterday 16:40", "25 Nov, 16:40" (Baku time). */
function when(iso: string, now: number, t: Dictionary["tasks"]): string {
  const at = new Date(iso);
  const minutes = Math.floor((now - at.getTime()) / 60000);
  if (minutes < 1) return t.nudge.justNow;
  if (minutes < 60) return fill(t.nudge.minAgo, { n: minutes });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  const day = dateInZone(at);
  const age = daysBetween(day, dateInZone(new Date(now)));
  if (age === 0) return fill(t.nudge.todayAt, { time });
  if (age === 1) return fill(t.nudge.yesterdayAt, { time });
  return fill(t.nudge.onAt, { date: shortDate(day, t), time });
}

/**
 * The bell on a card, for admins and managers: a small window shows who will be reminded (everyone on
 * the task but you) and the last reminder; "Send" notifies them in the site and on their phones. The
 * bell then rings and stays a ✓ for a minute.
 */
export function NudgeButton({ task, meId, t, onError, onOpenChange }: { task: TaskView; meId: string | undefined; t: Dictionary["tasks"]; onError?: (key: string) => void; onOpenChange?: (open: boolean) => void }) {
  const people = task.assignees.filter((p) => p.id !== meId);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const [up, setUp] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const { message, show } = useToast();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  // Opens downwards, or upwards when there is no room below; grows out of the bell.
  useLayoutEffect(() => {
    if (!open || closing || !panel.current || !button.current) return;
    const b = button.current.getBoundingClientRect();
    const height = panel.current.offsetHeight + 12;
    const goUp = b.bottom + height > window.innerHeight && b.top - height > 0;
    setUp(goUp);
    if (!prefersReducedMotion()) panel.current.animate([{ opacity: 0, transform: `translateY(${goUp ? 6 : -6}px) scale(0.96)` }, { opacity: 1, transform: "none" }], { duration: 260, easing: springOrFallback(420, 30, 0.26) });
  }, [open, closing]);

  const close = (after?: () => void) => {
    if (!open || closing) return;
    const el = panel.current;
    const done = () => {
      setOpen(false);
      setClosing(false);
      onOpenChange?.(false);
      after?.();
    };
    if (!el || prefersReducedMotion()) return done();
    setClosing(true);
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(${up ? 6 : -6}px) scale(0.96)` }], { duration: 150, easing: "ease-in", fill: "forwards" }).finished.then(done, done);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(() => button.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const toggle = () => {
    if (open) return close();
    setOpenedAt(Date.now());
    setOpen(true);
    onOpenChange?.(true);
  };

  // The bell swings a few times, then turns into a ✓.
  const ring = () => {
    const el = bell.current;
    if (!el || prefersReducedMotion()) return setSent(true);
    el.animate(
      [{ transform: "rotate(0)" }, { transform: "rotate(16deg)" }, { transform: "rotate(-14deg)" }, { transform: "rotate(10deg)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(3deg)" }, { transform: "rotate(0)" }],
      { duration: 650, easing: "ease-in-out" },
    ).finished.then(() => setSent(true), () => setSent(true));
  };

  const send = () =>
    startTransition(async () => {
      const result = await nudgeTask(task.id);
      close(() => {
        if (!result.ok) return onError?.(result.error);
        ring();
        show(fill(t.nudge.sent, { names: people.map((p) => p.name.split(/\s+/)[0]).join(", ") }));
        later(() => setSent(false), SENT_MS);
      });
    });

  if (!people.length) return null;
  // The window is placed against the parent (the bell and the status together), so it lines up
  // with the card's right edge and never runs off a phone screen.
  return (
    <div>
      <button
        ref={button}
        type="button"
        aria-label={sent ? t.nudge.sentLabel : t.nudge.button}
        title={sent ? t.nudge.sentLabel : t.nudge.button}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-nudge={sent ? "sent" : "ready"}
        onClick={toggle}
        className={`flex size-8 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-300 sm:size-11 ${sent ? "bg-teal text-white" : "bg-surface text-ink"} ${open && !closing ? "shadow-[0_0_0_2px_var(--color-teal)]" : ""}`}
      >
        {sent ? (
          <span key="sent" className="zk-pop flex">
            <Icon d={CHECK} />
          </span>
        ) : (
          <span key="bell" ref={bell} className="flex origin-[50%_10%]">
            <Icon d={BELL} />
          </span>
        )}
      </button>
      {open && (
        <>
          <button data-no-press type="button" aria-label={t.nudge.cancel} tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => close()} />
          <div
            ref={panel}
            role="dialog"
            aria-label={t.nudge.title}
            className={`absolute right-0 z-20 flex w-[min(320px,calc(100vw-40px))] flex-col gap-3 rounded-[20px] bg-surface p-4 text-left shadow-[0_14px_40px_rgba(24,35,47,0.28)] ${up ? "bottom-[calc(100%+8px)] origin-bottom-right" : "top-[calc(100%+8px)] origin-top-right"}`}
          >
            <h4 className="flex items-center gap-2.5 text-[15px] font-semibold">
              <span className="flex size-[34px] items-center justify-center rounded-xl bg-sun-tint text-sun-ink">
                <Icon d={BELL} />
              </span>
              {t.nudge.title}
            </h4>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] text-muted">{t.nudge.to}</span>
              <ul className="flex flex-wrap gap-1.5" aria-label={t.nudge.to}>
                {people.map((p) => (
                  <li key={p.id} className="flex min-w-0 items-center gap-1.5 rounded-full bg-mint-soft py-1 pl-1 pr-2.5 text-[13px] font-semibold">
                    <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: personColor(p.id) }}>
                      {initials(p.name)}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            {task.nudged && <p className="text-[12.5px] text-muted">{fill(t.nudge.last, { when: when(task.nudged.at, openedAt, t), name: task.nudged.by })}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => close(() => button.current?.focus())} className="min-h-[42px] rounded-full bg-mint-soft px-4 text-sm font-semibold hover:bg-mint">
                {t.nudge.cancel}
              </button>
              <button type="button" onClick={send} disabled={pending || closing} aria-busy={pending} className="flex min-h-[42px] items-center gap-2 rounded-full bg-teal px-4 text-sm font-semibold text-white disabled:opacity-80">
                {pending ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" /> : <Icon d={SEND} size={16} />}
                {t.nudge.send}
              </button>
            </div>
          </div>
        </>
      )}
      {message && createPortal(<Toast message={message} />, document.body)}
    </div>
  );
}
