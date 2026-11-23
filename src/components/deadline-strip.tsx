import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { daysBetween, weekdayIndex } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { deadlineState } from "@/lib/task-rules";

type T = Pick<Dictionary["tasks"], "weekdays" | "monthsShort" | "today" | "strip">;

/** Colours of the bar, its "today" marker and the chip, by where the task stands. */
const LOOK = {
  upcoming: { fill: "bg-ink/20", ring: "border-ink/40", label: "text-ink-soft", chip: "bg-ink/8 text-ink-soft" },
  running: { fill: "bg-teal", ring: "border-teal", label: "text-teal-deep", chip: "bg-teal-tint text-teal-deep" },
  lastDay: { fill: "bg-event", ring: "border-event", label: "text-sun-ink", chip: "bg-sun text-ink" },
  late: { fill: "bg-danger", ring: "border-danger", label: "text-danger", chip: "bg-danger/15 text-danger" },
  done: { fill: "bg-teal/45", ring: "border-teal", label: "text-teal-deep", chip: "bg-teal-tint text-teal-deep" },
  doneLate: { fill: "bg-teal/45", ring: "border-teal", label: "text-teal-deep", chip: "bg-ink/8 text-ink-soft" },
  cancelled: { fill: "bg-ink/20", ring: "border-ink/40", label: "text-ink-soft", chip: "bg-ink/8 text-ink-soft" },
  postponed: { fill: "bg-event/60", ring: "border-event", label: "text-sun-ink", chip: "bg-sun-tint text-sun-ink" },
};

/**
 * A task's span from its start day to its deadline, as a bar that fills up to today, with a chip
 * saying what matters now: starts in n days, n days left, due today, n days late, or done (early,
 * on time or late). On a narrow card the chip moves under the bar.
 */
export function DeadlineStrip({
  start,
  end,
  today,
  finished,
  cancelled = false,
  postponed = false,
  finishedOn,
  t,
}: {
  start: string;
  end: string;
  today: string;
  finished: boolean;
  cancelled?: boolean;
  postponed?: boolean;
  finishedOn: string | null;
  t: T;
}) {
  const s = t.strip;
  const state = deadlineState({ dueDate: start, deadline: end, finished: finished || cancelled, finishedOn }, today, daysBetween);
  // Cancelled: no more counting. Postponed: still open, never shown as late.
  const look = cancelled ? LOOK.cancelled : postponed && state.kind !== "upcoming" ? LOOK.postponed : state.kind === "done" ? LOOK[state.how === "late" ? "doneLate" : "done"] : LOOK[state.kind];
  const plural = (one: string, many: string, n: number) => (n === 1 ? one : fill(many, { n }));
  const chip = cancelled
    ? s.cancelled
    : postponed && state.kind !== "upcoming"
      ? s.postponed
      : state.kind === "upcoming"
      ? plural(s.startsTomorrow, s.startsIn, state.n)
      : state.kind === "running"
        ? plural(s.left1, s.leftN, state.n)
        : state.kind === "lastDay"
          ? s.dueToday
          : state.kind === "late"
            ? plural(s.late1, s.lateN, state.n)
            : state.how === "early"
              ? plural(s.early1, s.earlyN, state.n)
              : state.how === "late"
                ? plural(s.doneLate1, s.doneLateN, state.n)
                : state.how === "onTime"
                  ? s.onTime
                  : s.done;
  const showToday = !cancelled && (state.kind === "running" || state.kind === "lastDay");
  const pct = state.progress * 100;
  // The "Today" word stays inside the bar's ends instead of spilling over the dates.
  const labelAt = pct < 15 ? "left-[-4px]" : pct > 85 ? "right-[-4px]" : "left-1/2 -translate-x-1/2";
  const day = (iso: string) => t.weekdays[weekdayIndex(iso)].slice(0, 3);
  const end1 = (label: string, iso: string, right = false) => (
    <span className={`flex shrink-0 flex-col leading-tight ${right ? "items-end text-right" : ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <span className="whitespace-nowrap text-[15px] font-bold text-ink">{shortDate(iso, t)}</span>
      <span className="text-[11px] text-muted">{day(iso)}</span>
    </span>
  );

  return (
    <div
      role="group"
      aria-label={`${s.start} ${shortDate(start, t)}, ${s.deadline} ${shortDate(end, t)}: ${chip}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-surface/70 px-3.5 py-2.5"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-[1_1_240px] items-center gap-3">
        {end1(s.start, start)}
        <span className="relative h-1.5 min-w-12 flex-1 rounded-full bg-ink/12">
          <span className={`absolute inset-y-0 left-0 rounded-full ${look.fill}`} style={{ width: `${pct}%` }} />
          {showToday && (
            <span className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.18)] ${look.ring}`} style={{ left: `${pct}%` }}>
              <span className={`absolute bottom-[calc(100%+3px)] whitespace-nowrap text-[10px] font-bold ${labelAt} ${look.label}`}>{t.today}</span>
            </span>
          )}
        </span>
        {end1(s.deadline, end, true)}
      </div>
      <span className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${look.chip}`}>{chip}</span>
    </div>
  );
}
