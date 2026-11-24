"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { MiniCalendar } from "@/components/mini-calendar";
import { DaySwitcher, EventChips } from "@/components/day-header";
import { Collapse, SegmentedControl, scrollIntoViewSoftly, useFlip, useIsWide } from "@/components/motion";
import { avatarColor, TaskCard, type StatusOption } from "@/components/task-card";
import { Toast, useToast } from "@/components/toast";
import { initials } from "@/components/top-bar";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { shiftMonth, specialDaysOn, type SpecialDay } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import type { Section } from "@/lib/task-rules";
import { useHeldDay } from "@/components/held-day";
import type { DayTasks, TaskView } from "@/lib/tasks";

type Segment = "all" | Section;

export function BoardView({
  date,
  today,
  shownMonth,
  day: serverDay,
  counts,
  statuses,
  specialDays,
  people,
  customers,
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
  people: { id: string; name: string }[];
  customers: { id: string; name: string; color: string }[];
  t: Dictionary["tasks"];
  months: readonly string[];
  errors: Dictionary["errors"];
}) {
  // Cards still asking for their finished work stay where they were until it is answered.
  const day = useHeldDay(serverDay);
  const router = useRouter();
  const pathname = usePathname();
  const { message, show } = useToast();
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [peopleFilter, setPeopleFilter] = useState<string[]>([]);
  const [sideOpen, setSideOpen] = useState(false);
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

  const go = (params: { date?: string; m?: string }) => {
    const search = new URLSearchParams();
    search.set("date", params.date ?? date);
    if (params.m) search.set("m", params.m);
    router.push(`${pathname}?${search}`, { scroll: false });
  };

  const matches = (task: TaskView) => {
    if (customerFilter.length && !customerFilter.includes(task.customerId)) return false;
    if (peopleFilter.length && !task.assignees.some((p) => peopleFilter.includes(p.id))) return false;
    const q = query.trim().toLocaleLowerCase("az");
    if (!q) return true;
    return [task.contentCode, task.typeName, task.customerName, task.assignees.map((p) => p.name).join(" "), task.description, task.note].join(" ").toLocaleLowerCase("az").includes(q);
  };
  const filtered = useMemo(
    () => ({ overdue: day.overdue.filter(matches), due: day.due.filter(matches), postponed: day.postponed.filter(matches), finished: day.finished.filter(matches), cancelled: day.cancelled.filter(matches) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, query, customerFilter, peopleFilter],
  );
  const all = [...day.overdue, ...day.due, ...day.postponed, ...day.finished, ...day.cancelled];
  const total = all.length;
  const isToday = date === today;
  const events = specialDaysOn(date, specialDays);
  const hasFilters = customerFilter.length > 0 || peopleFilter.length > 0 || query.trim() !== "";

  const sections: { key: Section; label: string; color: string; hint?: string }[] = [
    { key: "overdue", label: t.sections.overdue, color: "text-danger", hint: t.overdueHint },
    { key: "due", label: isToday ? t.sections.due : t.sections.dueOn, color: "text-ink" },
    { key: "postponed", label: t.sections.postponed, color: "text-sun-ink" },
    { key: "finished", label: isToday ? t.sections.finished : t.sections.finishedOn, color: "text-teal-deep" },
    { key: "cancelled", label: isToday ? t.sections.cancelled : t.sections.cancelledOn, color: "text-muted" },
  ];
  const visible = sections.filter((s) => (segment === "all" || segment === s.key) && filtered[s.key].length > 0);
  const peopleToday = people.filter((p) => all.some((task) => task.assignees.some((a) => a.id === p.id)));

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const filterRow = (on: boolean) => (on ? "bg-mint" : "hover:bg-mint-soft");
  const box = (on: boolean) => (on ? "border-teal bg-teal" : "border-subtle bg-surface");
  const check = <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-x-6 lg:gap-y-6">
        <div ref={sidePanel} className="min-w-0 flex-[1_1_300px] scroll-mt-3 max-lg:basis-full lg:max-w-[340px]">
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

          <section aria-label={fill(b.summary, { date: shortDate(date, t) })} className="flex flex-col gap-3.5 rounded-[28px] bg-teal p-[22px] text-white">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-teal-tint">{fill(b.summary, { date: shortDate(date, t) })}</span>
              <span className="text-[26px] font-semibold">{total === 1 ? t.task1 : fill(t.tasksN, { n: total })}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[[day.overdue.length, b.overdue], [day.due.length, b.open], [day.postponed.length, b.postponed], [day.finished.length, b.finished], [day.cancelled.length, b.cancelled]].map(([n, label]) => (
                <div key={label} className="flex flex-col gap-0.5"><span className="text-xl font-semibold">{n}</span><span className="text-xs text-teal-tint">{label}</span></div>
              ))}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-teal-deep">
              <div className="h-2 rounded-full bg-sun" style={{ width: `${total ? Math.round((day.finished.length / total) * 100) : 0}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {peopleToday.slice(0, 8).map((p) => (
                <span key={p.id} title={p.name} className="flex size-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-teal-deep">{initials(p.name)}</span>
              ))}
              <span className="ml-1 text-xs text-teal-tint">{peopleToday.length === 0 ? b.nobody : peopleToday.length === 1 ? b.personWorking : fill(b.peopleWorking, { n: peopleToday.length })}</span>
            </div>
          </section>

          <section aria-label={b.customers} className="flex flex-col gap-2.5 rounded-[28px] bg-surface px-5 py-[22px]">
            <h2 className="text-lg font-semibold">{b.customers}</h2>
            <div className="flex flex-col gap-1">
              {customers.map((c) => {
                const on = customerFilter.includes(c.id);
                return (
                  <div key={c.id} className="flex items-center gap-1">
                    <button type="button" aria-pressed={on} onClick={() => toggle(customerFilter, setCustomerFilter, c.id)} className={`flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 text-left text-sm ${filterRow(on)}`}>
                      <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] ${box(on)}`}>{on && check}</span>
                      <span className="size-3 shrink-0 rounded-full border-[1.5px] border-black/25" style={{ background: c.color }} />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      <span className="text-xs text-muted">{all.filter((x) => x.customerId === c.id).length}</span>
                    </button>
                    <Link href={`/customers/${c.id}?tab=tasks&date=${date}`} aria-label={fill(b.openCustomer, { name: c.name })} title={fill(b.openCustomer, { name: c.name })} className="flex size-11 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-label={b.assignees} className="flex flex-col gap-2.5 rounded-[28px] bg-surface px-5 py-[22px]">
            <h2 className="text-lg font-semibold">{b.assignees}</h2>
            <div className="flex flex-col gap-1">
              {people.map((p) => {
                const on = peopleFilter.includes(p.id);
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(peopleFilter, setPeopleFilter, p.id)} className={`flex min-h-11 items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 text-left text-sm ${filterRow(on)}`}>
                    <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] ${box(on)}`}>{on && check}</span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatarColor(p.id) }}>{initials(p.name)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted">{all.filter((x) => x.assignees.some((a) => a.id === p.id)).length}</span>
                  </button>
                );
              })}
            </div>
            {hasFilters && (
              <button type="button" onClick={() => { setCustomerFilter([]); setPeopleFilter([]); setQuery(""); }} className="min-h-11 self-start px-2.5 text-sm font-semibold text-teal-deep underline">
                {b.clearFilters}
              </button>
            )}
          </section>
        </aside>
        </Collapse>
        </div>

        <main className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <header className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 rounded-[28px] bg-surface px-3.5 py-3 sm:px-[22px] sm:py-[18px]">
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[13px] font-semibold text-teal-deep">{b.title}</span>
                <button type="button" onClick={toggleSide} aria-expanded={sideOpen} className="flex min-h-11 items-center gap-2 rounded-full bg-mint px-3.5 text-[13px] font-semibold lg:hidden">
                  {b.filters}
                </button>
              </div>
              <DaySwitcher date={date} today={today} onGo={(iso) => go({ date: iso })} t={t} months={months} />
              <EventChips events={events} t={t} />
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={b.search} aria-label={b.search} className="h-11 min-w-0 flex-[1_1_180px] rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-sm" />
              <SegmentedControl
                label={b.showLabel}
                value={segment}
                onChange={(key) => setSegment(key as Segment)}
                stretch
                className="w-full overflow-x-auto sm:w-auto"
                itemClassName="min-h-10 px-2 text-[13px] sm:px-3.5 sm:text-sm"
                items={(["all", "overdue", "due", "postponed", "finished", "cancelled"] as Segment[]).map((key) => ({
                  key,
                  label: b.segments[key],
                  count: key === "all" ? Object.values(filtered).reduce((n, list) => n + list.length, 0) : filtered[key].length,
                }))}
              />
            </div>
          </header>

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
                <span className="text-lg font-semibold">{hasFilters || segment !== "all" ? t.emptyFiltered : t.emptyDay}</span>
                <span className="text-sm text-muted">{hasFilters || segment !== "all" ? t.emptyFilteredHint : t.emptyDayHint}</span>
              </div>
            )}
          </div>
        </main>
      </div>
      <Toast message={message} />
    </div>
  );
}
