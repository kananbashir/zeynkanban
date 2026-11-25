"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { addDays, type SpecialDay } from "@/lib/dates";
import { dayLabel, longDate } from "@/lib/format-date";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { SlideByDate } from "./motion";

type TaskT = Dictionary["tasks"];

const arrow = (d: string) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/**
 * The date line shared by the day views: arrows, the date (it slides when it changes), and either a
 * "Today" tag or a small button back to today. `actions` sit at the right end of the same line.
 */
export function DaySwitcher({
  date,
  today,
  onGo,
  t,
  months,
  heading = "h1",
  titleClass = "text-[19px] sm:text-[26px]",
  extra,
  actions,
}: {
  date: string;
  today: string;
  onGo: (date: string) => void;
  t: TaskT;
  months: readonly string[];
  heading?: "h1" | "h2";
  titleClass?: string;
  /** Right after "Today" (e.g. the day's holiday chips). */
  extra?: ReactNode;
  actions?: ReactNode;
}) {
  const Heading = heading;
  const fmt = { ...t, months };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
      <div className="flex min-w-0 items-center gap-0.5">
        <button type="button" aria-label={t.prevDay} onClick={() => onGo(addDays(date, -1))} className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
          {arrow("m15 18-6-6 6-6")}
        </button>
        <Heading className={`min-w-0 overflow-hidden whitespace-nowrap font-semibold ${titleClass}`}>
          <SlideByDate date={date}>
            <span className="hidden sm:inline">{longDate(date, fmt)}</span>
            <span className="sm:hidden">{dayLabel(date, fmt, Number(today.slice(0, 4)))}</span>
          </SlideByDate>
        </Heading>
        <button type="button" aria-label={t.nextDay} onClick={() => onGo(addDays(date, 1))} className="flex size-11 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
          {arrow("m9 18 6-6-6-6")}
        </button>
      </div>
      {date === today ? (
        <span className="shrink-0 rounded-full bg-teal-tint px-3 py-1.5 text-[13px] font-semibold text-teal-deep">{t.today}</span>
      ) : (
        <button type="button" onClick={() => onGo(today)} className="zk-pop flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-sun px-3.5 text-[13px] font-semibold text-ink sm:min-h-9">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
          </svg>
          {t.goToday}
        </button>
      )}
      {extra}
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

const EVENT_ICON = {
  holiday: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  event: "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z",
};

function EventChip({ e, t }: { e: SpecialDay; t: TaskT }) {
  return (
    <span title={`${t.dayKinds[e.kind]}: ${e.name}`} className="flex min-w-0 max-w-[220px] items-center gap-1.5 rounded-full bg-sun-tint py-1 pl-2 pr-2.5 text-xs font-semibold text-sun-ink">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        <path d={EVENT_ICON[e.kind]} />
      </svg>
      <span className="sr-only">{t.dayKinds[e.kind]}: </span>
      <span className="truncate">{e.name}</span>
    </span>
  );
}

/**
 * Holidays and special events of the day: a small icon says which kind, the text is its name.
 * With `max`, only that many show; the rest fold into a "+N" chip that lists every one when tapped.
 */
export function EventChips({ events, t, max }: { events: SpecialDay[]; t: TaskT; max?: number }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const shown = max && events.length > max ? events.slice(0, max) : events;
  const hidden = events.length - shown.length;
  useLayoutEffect(() => {
    if (!open || closing || !pop.current || prefersReducedMotion()) return;
    pop.current.animate([{ opacity: 0, transform: "translateY(-6px) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: springOrFallback(420, 32, 0.24) });
  }, [open, closing]);
  const close = () => {
    if (!open || closing) return;
    const done = () => {
      setOpen(false);
      setClosing(false);
    };
    if (!pop.current || prefersReducedMotion()) return done();
    setClosing(true);
    pop.current.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px) scale(0.96)" }], { duration: 150, easing: "ease-in", fill: "forwards" }).finished.then(done, done);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  });
  if (!events.length) return null;
  return (
    <div ref={box} className="relative flex min-w-0 flex-wrap items-center gap-1.5">
      {shown.map((e) => (
        <EventChip key={`${e.kind}-${e.name}`} e={e} t={t} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={open && !closing}
          aria-label={`+${hidden}: ${events.map((e) => e.name).join(", ")}`}
          onClick={() => (open ? close() : setOpen(true))}
          className="flex min-h-7 items-center rounded-full border-[1.5px] border-sun-ink/40 px-2.5 text-xs font-bold text-sun-ink hover:bg-sun-tint"
        >
          +{hidden}
        </button>
      )}
      {open && (
        <div ref={pop} role="dialog" aria-label={t.dayKinds.holiday} className="absolute right-0 top-[calc(100%+8px)] z-30 flex min-w-[240px] origin-top-right flex-col gap-0.5 rounded-2xl border border-line bg-surface p-2 shadow-[0_18px_44px_rgba(24,35,47,0.28)]">
          {events.map((e) => (
            <span key={`${e.kind}-${e.name}`} className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-2.5 text-[13.5px] font-semibold">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-event">
                <path d={EVENT_ICON[e.kind]} />
              </svg>
              {e.name}
              <span className="ml-auto pl-4 text-[11.5px] font-semibold text-muted">{t.dayKinds[e.kind]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** A small, quiet button for the end of the date line (e.g. "See whole day", "Calendar"). */
export const lineButton = "flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-mint px-3.5 text-[13px] font-semibold text-ink hover:bg-teal-tint sm:min-h-9";
