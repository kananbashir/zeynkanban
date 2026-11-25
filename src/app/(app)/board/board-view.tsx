"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MiniCalendar } from "@/components/mini-calendar";
import { DaySwitcher, EventChips } from "@/components/day-header";
import { DaySummary } from "@/components/day-summary";
import { FilterSheet, StickyDayBar, TaskSearch, useDayFilters, useFitHeight, useScrolledEdge, type ContentTypeName } from "@/components/day-filters";
import { FilterBar } from "@/components/filter-bar";
import { Collapse, scrollIntoViewSoftly, useFlip, useIsWide } from "@/components/motion";
import { TaskCard, type StatusOption } from "@/components/task-card";
import { Toast, useToast } from "@/components/toast";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { shiftMonth, specialDaysOn, type SpecialDay } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { isFiltered, SECTIONS } from "@/lib/task-filters";
import type { Section } from "@/lib/task-rules";
import { useHeldDay } from "@/components/held-day";
import type { DayTasks } from "@/lib/tasks";

export function BoardView({
  date,
  today,
  shownMonth,
  day: serverDay,
  counts,
  statuses,
  specialDays,
  contentTypes,
  t,
  months,
  errors,
}: {
  date: string;
  today: string;
  shownMonth: { year: number; month: number };
  day: DayTasks;
  counts: Record<string, number>;
  statuses: StatusOption[];
  specialDays: SpecialDay[];
  /** Content types in the order of Settings, for the content type filter's names and colours. */
  contentTypes: ContentTypeName[];
  t: Dictionary["tasks"];
  months: readonly string[];
  errors: Dictionary["errors"];
}) {
  // Cards still asking for their finished work stay where they were until it is answered.
  const day = useHeldDay(serverDay);
  const router = useRouter();
  const pathname = usePathname();
  const { message, show } = useToast();
  const [sideOpen, setSideOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const wide = useIsWide();
  const sidePanel = useRef<HTMLDivElement>(null);
  // On phones the calendar opens above the list; glide up to it when it opens.
  const toggleSide = () => {
    const next = !sideOpen;
    setSideOpen(next);
    if (next) scrollIntoViewSoftly(sidePanel.current);
  };
  const b = t.board;
  const list = useRef<HTMLDivElement>(null);
  useFlip(list);
  // On a computer the page fits the screen and only the task list scrolls.
  const page = useRef<HTMLDivElement>(null);
  useFitHeight(page);
  const { onScroll, edge, compact } = useScrolledEdge();
  const headerBox = useRef<HTMLElement>(null);

  const go = (params: { date?: string; m?: string }) => {
    const search = new URLSearchParams();
    search.set("date", params.date ?? date);
    if (params.m) search.set("m", params.m);
    router.push(`${pathname}?${search}`, { scroll: false });
  };

  const { filters, query, setQuery, filtered, shown, groups, count, clearAll } = useDayFilters({ day, contentTypes, t, date, staff: true, people: true });
  const all = SECTIONS.flatMap((s) => day[s]);
  const total = all.length;
  const isToday = date === today;
  const events = specialDaysOn(date, specialDays);
  const hasFilters = isFiltered(filters);

  const sections: { key: Section; label: string; color: string; hint?: string }[] = [
    { key: "overdue", label: t.sections.overdue, color: "text-danger", hint: t.overdueHint },
    { key: "due", label: isToday ? t.sections.due : t.sections.dueOn, color: "text-ink" },
    { key: "postponed", label: t.sections.postponed, color: "text-sun-ink" },
    { key: "finished", label: isToday ? t.sections.finished : t.sections.finishedOn, color: "text-teal-deep" },
    { key: "cancelled", label: isToday ? t.sections.cancelled : t.sections.cancelledOn, color: "text-muted" },
  ];
  const visible = sections.filter((s) => filtered[s.key].length > 0);
  const peopleToday = [...new Map(all.flatMap((task) => task.assignees).map((p) => [p.id, p.name])).values()].sort((x, y) => x.localeCompare(y, "az"));

  return (
    <div ref={page} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-x-6 lg:min-h-0 lg:flex-1 lg:flex-nowrap lg:items-stretch lg:gap-y-6">
        <div ref={sidePanel} className="min-w-0 flex-[1_1_300px] scroll-mt-3 max-lg:basis-full lg:max-w-[340px] lg:overflow-y-auto lg:[scrollbar-width:thin]">
        <Collapse open={sideOpen} keepMounted inertWhenClosed={!wide} className="zk-collapse-lg-open">
        <aside className="flex flex-col gap-5 pb-5 lg:pb-0">
          <section aria-label={b.title} className="rounded-[28px] bg-surface px-5 pb-[18px] pt-[22px]">
            <MiniCalendar
              year={shownMonth.year}
              month={shownMonth.month}
              selected={date}
              today={today}
              counts={counts}
              specialDays={specialDays}
              months={months}
              weekdaysShort={t.weekdaysShort}
              prevLabel={t.prevMonth}
              nextLabel={t.nextMonth}
              onPick={(iso) => go({ date: iso })}
              onMonth={(delta) => {
                const m = shiftMonth(shownMonth.year, shownMonth.month, delta);
                go({ m: `${m.year}-${String(m.month).padStart(2, "0")}` });
              }}
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-[5px] rounded-full bg-teal" />{t.calendarTasks}</span>
              <span className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-sm bg-event" />{t.calendarEvent}</span>
            </div>
          </section>

          <DaySummary
            label={fill(b.summary, { date: shortDate(date, t) })}
            title={b.summaryTitle}
            total={total === 1 ? t.task1 : fill(t.tasksN, { n: total })}
            counts={{ overdue: day.overdue.length, open: day.due.length, postponed: day.postponed.length, finished: day.finished.length, cancelled: day.cancelled.length }}
            labels={{ overdue: b.overdue, open: b.open, postponed: b.postponed, finished: b.finished, cancelled: b.cancelled, working: b.working }}
            working={{ count: peopleToday.length, names: peopleToday }}
          />
        </aside>
        </Collapse>
        </div>

        <main className="flex min-w-0 flex-[999_1_520px] flex-col gap-5 lg:min-h-0">
          {/* The day and its holidays, then the search box and the filters. On a computer the date line folds
              away while the list is scrolled, and comes back at the top. */}
          <header ref={headerBox} className="flex flex-col gap-3 rounded-[28px] bg-surface px-3.5 py-3 sm:px-[22px] sm:py-4">
            <Collapse open={!(compact && wide)}>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2 lg:hidden">
                  <span className="flex-1 text-[13px] font-semibold text-teal-deep">{b.title}</span>
                  <button type="button" onClick={toggleSide} aria-expanded={sideOpen} className="flex min-h-11 items-center gap-2 rounded-full bg-mint px-3.5 text-[13px] font-semibold">
                    {b.filters}
                  </button>
                </div>
                <DaySwitcher date={date} today={today} onGo={(iso) => go({ date: iso })} t={t} months={months} titleClass="text-[19px] sm:text-[24px] lg:text-[22px]" extra={<EventChips events={events} t={t} max={2} />} />
              </div>
            </Collapse>
            <FilterBar groups={groups} t={t.filters} onClearAll={clearAll} lead={<TaskSearch value={query} onChange={setQuery} label={b.search} className="lg:rounded-2xl" />} />
          </header>

          {/* On a computer only this part scrolls; the calendar, summary, header and filters stay put. */}
          <div data-task-scroll onScroll={onScroll} className={`lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:rounded-[28px] lg:[scrollbar-width:thin] ${edge}`}>
          <div ref={list} className="flex flex-col gap-[26px] rounded-[28px] bg-surface p-4 sm:p-[22px]">
            {visible.map((section) => (
              <section key={section.key} className="flex flex-col gap-3">
                <div data-flip={`heading-${section.key}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2 className={`text-base font-semibold ${section.color}`}>{section.label}</h2>
                  <span className="text-[13px] text-muted">
                    {filtered[section.key].length}
                    {section.hint ? ` · ${section.hint}` : ""}
                  </span>
                </div>
                {filtered[section.key].map((task) => (
                  <TaskCard
                    contentWindow
                    key={task.id}
                    task={task}
                    statuses={statuses}
                    canChangeStatus
                    today={today}
                    t={t}
                    editHref={`/customers/${task.customerId}?tab=tasks&date=${task.dueDate}&edit=${task.id}`}
                    onError={(key) => show(errors[key as ErrorKey] ?? errors.generic, "error")}
                  />
                ))}
              </section>
            ))}
            {visible.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 px-4 py-14 text-center">
                <span className="text-lg font-semibold">{hasFilters ? t.emptyFiltered : t.emptyDay}</span>
                <span className="text-sm text-muted">{hasFilters ? t.emptyFilteredHint : t.emptyDayHint}</span>
              </div>
            )}
          </div>
          </div>
        </main>
      </div>
      <StickyDayBar watch={headerBox} title={b.title} date={date} onGo={(iso) => go({ date: iso })} t={t} count={count} onFilter={() => setSheet(true)} />
      {sheet && <FilterSheet onClose={() => setSheet(false)} groups={groups} query={query} setQuery={setQuery} onClearAll={clearAll} shown={shown} t={t} />}
      <Toast message={message} />
    </div>
  );
}
