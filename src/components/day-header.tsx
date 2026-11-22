"use client";

import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { addDays, type SpecialDay } from "@/lib/dates";
import { dayLabel, longDate } from "@/lib/format-date";
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
  actions,
}: {
  date: string;
  today: string;
  onGo: (date: string) => void;
  t: TaskT;
  months: readonly string[];
  heading?: "h1" | "h2";
  titleClass?: string;
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
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

/** Holidays and special events of the day: a small icon says which kind, the text is its name. */
export function EventChips({ events, t }: { events: SpecialDay[]; t: TaskT }) {
  if (!events.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {events.map((e) => (
        <span key={`${e.kind}-${e.name}`} title={t.dayKinds[e.kind]} className="flex items-center gap-1.5 rounded-full bg-sun-tint py-1 pl-2 pr-2.5 text-xs font-semibold text-sun-ink">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            <path d={e.kind === "holiday" ? "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" : "m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"} />
          </svg>
          <span className="sr-only">{t.dayKinds[e.kind]}: </span>
          {e.name}
        </span>
      ))}
    </div>
  );
}

/** A small, quiet button for the end of the date line (e.g. "See whole day", "Calendar"). */
export const lineButton = "flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-mint px-3.5 text-[13px] font-semibold text-ink hover:bg-teal-tint sm:min-h-9";
