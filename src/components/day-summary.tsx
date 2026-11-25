"use client";

const ICONS = {
  overdue: "M12 8v4M12 16h.01M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
  open: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2",
  postponed: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M10 9v6M14 9v6",
  finished: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  cancelled: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M5.6 5.6l12.8 12.8",
  working: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
} as const;
type Key = keyof typeof ICONS;
const TINT: Record<Key, string> = {
  overdue: "#d2453a",
  open: "rgb(255 255 255 / 0.24)",
  postponed: "#c47a00",
  finished: "#1d6b42",
  cancelled: "rgb(0 0 0 / 0.3)",
  working: "rgb(255 255 255 / 0.24)",
};

export type SummaryCounts = { overdue: number; open: number; postponed: number; finished: number; cancelled: number };

/**
 * The day in short, on the teal card beside the task list: one line with how many tasks, then a
 * small tile per group with an icon, its number and its name. Groups with nothing are faded. On the
 * board a sixth tile shows how many people work that day (their names on hover).
 */
export function DaySummary({
  label,
  title,
  total,
  counts,
  labels,
  working,
}: {
  /** For screen readers, with the date ("Day summary · 26 Nov"). */
  label: string;
  /** Shown before the number of tasks ("Day summary"). */
  title: string;
  total: string;
  counts: SummaryCounts;
  labels: Record<keyof SummaryCounts, string> & { working?: string };
  working?: { count: number; names: string[] };
}) {
  const tiles: { key: Key; n: number; label: string; title?: string }[] = [
    { key: "overdue", n: counts.overdue, label: labels.overdue },
    { key: "open", n: counts.open, label: labels.open },
    { key: "postponed", n: counts.postponed, label: labels.postponed },
    { key: "finished", n: counts.finished, label: labels.finished },
    { key: "cancelled", n: counts.cancelled, label: labels.cancelled },
    ...(working && labels.working ? [{ key: "working" as const, n: working.count, label: labels.working, title: working.names.join(", ") }] : []),
  ];
  return (
    <section aria-label={label} className="flex flex-col gap-2.5 rounded-[24px] bg-teal px-4 pb-4 pt-3 text-white">
      <p className="text-[13px] font-medium text-white/80">
        {title} · <b key={total} className="zk-fade-up inline-block font-semibold text-white">{total}</b>
      </p>
      <ul className="grid grid-cols-3 gap-1.5">
        {tiles.map((x) => (
          <li key={x.key} data-summary={x.key} title={x.title} className={`flex min-w-0 flex-col gap-1 rounded-xl bg-black/15 px-2 pb-[9px] pt-2 transition-opacity duration-300 ${x.n ? "" : "opacity-55"}`}>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-md" style={{ background: TINT[x.key] }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONS[x.key]} />
                </svg>
              </span>
              <span key={x.n} className="zk-fade-up text-base font-bold leading-none">{x.n}</span>
            </span>
            <span className="text-[11px] leading-tight text-white/80 [overflow-wrap:anywhere]">{x.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
