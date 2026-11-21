"use client";

import { monthGrid, specialDaysOn, type SpecialDay } from "@/lib/dates";

/** A month calendar. Dots mark days with tasks, a bar marks holidays and special events; or, with showCounts, the number of tasks. */
export function MiniCalendar({
  year,
  month,
  selected,
  today,
  counts,
  specialDays,
  months,
  weekdaysShort,
  prevLabel,
  nextLabel,
  onPick,
  onMonth,
  showCounts = false,
  cellHeight = 42,
}: {
  year: number;
  month: number;
  selected: string;
  today: string;
  counts: Record<string, number>;
  specialDays: SpecialDay[];
  months: readonly string[];
  weekdaysShort: readonly string[];
  prevLabel: string;
  nextLabel: string;
  onPick: (iso: string) => void;
  onMonth: (delta: number) => void;
  showCounts?: boolean;
  cellHeight?: number;
}) {
  const cells = monthGrid(year, month);
  const arrow = (d: string) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h2 className="flex-1 text-lg font-semibold">
          {months[month - 1]} {year}
        </h2>
        <button type="button" aria-label={prevLabel} onClick={() => onMonth(-1)} className="flex size-11 items-center justify-center rounded-full text-icon hover:bg-mint">
          {arrow("m15 18-6-6 6-6")}
        </button>
        <button type="button" aria-label={nextLabel} onClick={() => onMonth(1)} className="flex size-11 items-center justify-center rounded-full text-icon hover:bg-mint">
          {arrow("m9 18 6-6-6-6")}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weekdaysShort.map((w) => (
          <span key={w} className="pb-2 pt-1 text-center text-[11px] font-semibold text-muted">
            {w}
          </span>
        ))}
        {cells.map(({ iso, inMonth }) => {
          const n = counts[iso] ?? 0;
          const events = specialDaysOn(iso, specialDays);
          const sel = iso === selected;
          const isToday = iso === today;
          const look = sel
            ? "bg-teal text-white font-semibold"
            : events.length && showCounts
              ? "bg-sun-tint text-ink font-medium"
              : isToday
                ? "bg-sun-tint text-ink font-semibold"
                : inMonth
                  ? "text-ink font-medium hover:bg-mint"
                  : "text-[#6b7785] hover:bg-mint";
          const label = `${Number(iso.slice(8))} ${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}${n ? `, ${n}` : ""}${events.length ? `, ${events.map((e) => e.name).join(", ")}` : ""}`;
          return (
            <button
              key={iso}
              type="button"
              aria-label={label}
              aria-pressed={sel}
              title={events.map((e) => e.name).join(", ") || undefined}
              onClick={() => onPick(iso)}
              style={{ height: cellHeight }}
              className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-[14px] text-[13px] ${look}`}
            >
              <span>{Number(iso.slice(8))}</span>
              {showCounts ? (
                <span className={`h-2.5 text-[10px] font-semibold leading-none tabular-nums ${sel ? "text-teal-tint" : "text-muted"}`}>{n || ""}</span>
              ) : (
                <span className="flex h-[5px] items-center gap-[3px]">
                  {n > 0 && <span className={`size-[5px] rounded-full ${sel ? "bg-white" : "bg-teal"}`} />}
                  {events.length > 0 && <span className={`h-1 w-2.5 rounded-sm ${sel ? "bg-sun" : "bg-[#b87a00]"}`} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
