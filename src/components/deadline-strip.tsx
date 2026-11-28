import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { daysBetween } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { deadlineState } from "@/lib/task-rules";

type T = Pick<Dictionary["tasks"], "monthsShort" | "today" | "strip">;

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
 * on time or late). The start and deadline are day tiles; while running with room to spare the
 * chip sits on the bar, otherwise after the deadline (on a phone, on its own row under the bar).
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

  // Running with room to spare: the chip sits on the bar, between today and the deadline; otherwise after the deadline.
  const onBar = showToday && state.kind === "running" && pct <= 40;
  const late = state.kind === "late" && !cancelled && !postponed;
  const tile = (iso: string, ring = false) => (
    <span className={`flex size-[52px] shrink-0 flex-col items-center justify-center rounded-xl bg-surface leading-[1.1] max-sm:size-[29px] max-sm:rounded-[7px] ${ring ? "shadow-[inset_0_0_0_1.5px_var(--color-danger)]" : ""}`}>
      <b className="text-[17px] max-sm:text-[10.5px]">{Number(iso.slice(8))}</b>
      <span className="text-[11px] font-semibold text-muted max-sm:text-[7.5px]">{t.monthsShort[Number(iso.slice(5, 7)) - 1]}</span>
    </span>
  );
  const chipEl = (extra = "") => (
    <span className={`flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-bold leading-none max-sm:h-5 max-sm:px-2 max-sm:text-[9.5px] ${look.chip} ${extra}`}>{chip}</span>
  );

  return (
    <div
      role="group"
      aria-label={`${s.start} ${shortDate(start, t)}, ${s.deadline} ${shortDate(end, t)}: ${chip}`}
      className="zk-panel flex flex-wrap items-center gap-3 rounded-[16px] px-3 py-2.5 max-sm:gap-[5px] max-sm:rounded-[13px] max-sm:p-[5px]"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-[1_1_200px] items-center gap-3 max-sm:gap-[5px]">
        {tile(start)}
        <span className="relative h-1.5 min-w-12 flex-1 rounded-full bg-ink/14 max-sm:h-[3px]">
          <span className={`absolute inset-y-0 left-0 rounded-full ${late ? "bg-danger" : look.fill}`} style={{ width: `${pct}%` }} />
          {showToday && (
            <span
              className={`absolute top-1/2 flex h-6 -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap rounded-full border-[1.5px] bg-surface px-2.5 text-[11.5px] font-bold leading-none max-sm:h-[15px] max-sm:px-[5px] max-sm:text-[8px] ${look.ring} ${look.label}`}
              style={{ left: `clamp(28px, ${pct}%, calc(100% - 28px))` }}
            >
              {t.today}
            </span>
          )}
          {onBar && (
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(pct + 100) / 2 + 4}%` }}>
              {chipEl("h-6 max-sm:h-[15px] max-sm:text-[8px]")}
            </span>
          )}
        </span>
        {tile(end, late)}
      </div>
      {!onBar && chipEl("max-sm:basis-full max-sm:order-last")}
    </div>
  );
}
