"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { addPersonalTask, deletePersonalTask, setPersonalDone } from "@/app/actions/personal";
import { MiniCalendar } from "@/components/mini-calendar";
import { DaySwitcher, EventChips, lineButton } from "@/components/day-header";
import { Collapse, scrollIntoViewSoftly, useFlip, useIsWide } from "@/components/motion";
import { TaskCard, type StatusOption } from "@/components/task-card";
import { Toast, useToast } from "@/components/toast";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { shiftMonth, specialDaysOn, type SpecialDay } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import type { PersonalTask } from "@/lib/personal";
import { PERSONAL_REMINDERS } from "@/lib/reminder-rules";
import type { Section } from "@/lib/task-rules";
import type { DayTasks } from "@/lib/tasks";

type T = Dictionary["myTasks"];
type TaskT = Dictionary["tasks"];

const icon = (d: string, size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    <path d={d} />
  </svg>
);

export function MyTasksView({
  date,
  today,
  shownMonth,
  day,
  counts,
  statuses,
  specialDays,
  personal,
  canOpenTasks,
  t,
  taskT,
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
  personal: PersonalTask[];
  canOpenTasks: boolean;
  t: T;
  taskT: TaskT;
  months: readonly string[];
  errors: Dictionary["errors"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { message, show } = useToast();
  const [sideOpen, setSideOpen] = useState(false);
  const wide = useIsWide();
  const sidePanel = useRef<HTMLDivElement>(null);
  // On phones the calendar opens above the list; glide up to it when it opens.
  const toggleSide = () => {
    const next = !sideOpen;
    setSideOpen(next);
    if (next) scrollIntoViewSoftly(sidePanel.current);
  };
  const isToday = date === today;
  const events = specialDaysOn(date, specialDays);
  const list = useRef<HTMLDivElement>(null);
  useFlip(list);
  const onError = (key: string) => show(errors[key as ErrorKey] ?? errors.generic, "error");

  const go = (params: { date?: string; m?: string }) => {
    const search = new URLSearchParams({ date: params.date ?? date });
    if (params.m) search.set("m", params.m);
    router.push(`${pathname}?${search}`, { scroll: false });
  };

  const sections: { key: Section; label: string; color: string; hint?: string }[] = [
    { key: "overdue", label: taskT.sections.overdue, color: "text-danger", hint: taskT.overdueHint },
    { key: "due", label: isToday ? taskT.sections.due : taskT.sections.dueOn, color: "text-ink" },
    { key: "postponed", label: taskT.sections.postponed, color: "text-sun-ink" },
    { key: "finished", label: isToday ? taskT.sections.finished : taskT.sections.finishedOn, color: "text-teal-deep" },
    { key: "cancelled", label: isToday ? taskT.sections.cancelled : taskT.sections.cancelledOn, color: "text-muted" },
  ];
  const visible = sections.filter((s) => day[s.key].length > 0);
  const total = day.overdue.length + day.due.length + day.postponed.length + day.finished.length + day.cancelled.length;

  return (
    <div className="flex flex-wrap items-start gap-x-6 lg:gap-y-6">
      <div ref={sidePanel} className="min-w-0 flex-[1_1_300px] scroll-mt-3 max-lg:basis-full lg:max-w-[340px]">
      <Collapse open={sideOpen} keepMounted inertWhenClosed={!wide} className="zk-collapse-lg-open">
      <aside className="flex flex-col gap-5 pb-5 lg:pb-0">
        <section aria-label={t.calendar} className="rounded-[28px] bg-surface px-5 pb-[18px] pt-[22px]">
          <MiniCalendar
            year={shownMonth.year}
            month={shownMonth.month}
            selected={date}
            today={today}
            counts={counts}
            specialDays={specialDays}
            months={months}
            weekdaysShort={taskT.weekdaysShort}
            prevLabel={taskT.prevMonth}
            nextLabel={taskT.nextMonth}
            onPick={(iso) => go({ date: iso })}
            onMonth={(delta) => {
              const m = shiftMonth(shownMonth.year, shownMonth.month, delta);
              go({ m: `${m.year}-${String(m.month).padStart(2, "0")}` });
            }}
          />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-[5px] rounded-full bg-teal" />{t.legendMine}</span>
            <span className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-sm bg-event" />{t.legendEvent}</span>
          </div>
        </section>

        <section aria-label={fill(t.summary, { date: shortDate(date, taskT) })} className="flex flex-col gap-3.5 rounded-[28px] bg-teal p-[22px] text-white">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-teal-tint">{fill(t.summary, { date: shortDate(date, taskT) })}</span>
            <span key={total} className="zk-fade-up text-[26px] font-semibold">{total === 1 ? taskT.task1 : fill(taskT.tasksN, { n: total })}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([[day.overdue.length, t.overdue], [day.due.length, t.open], [day.postponed.length, t.postponed], [day.finished.length, t.finished], [day.cancelled.length, t.cancelled]] as const).map(([n, label]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span key={n} className="zk-fade-up text-xl font-semibold">{n}</span>
                <span className="text-xs text-teal-tint">{label}</span>
              </div>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-teal-deep">
            <div className="h-2 rounded-full bg-sun transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ width: `${total ? Math.round((day.finished.length / total) * 100) : 0}%` }} />
          </div>
        </section>
      </aside>
      </Collapse>
      </div>

      <main className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
        <header className="flex flex-col gap-2.5 rounded-[28px] bg-surface px-3.5 py-3 sm:px-[22px] sm:py-[18px]">
          <DaySwitcher
            date={date}
            today={today}
            onGo={(iso) => go({ date: iso })}
            t={taskT}
            months={months}
            actions={
              <button type="button" onClick={toggleSide} aria-expanded={sideOpen} className={`${lineButton} lg:hidden`}>
                {icon("M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18", 15)}
                {t.calendar}
              </button>
            }
          />
          <EventChips events={events} t={taskT} />
        </header>

        <div ref={list} className="flex flex-col gap-[26px] rounded-[28px] bg-surface p-4 sm:p-[22px]">
          {visible.map((section) => (
            <section key={section.key} className="flex flex-col gap-3">
              <div data-flip={`heading-${section.key}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h2 className={`text-base font-semibold ${section.color}`}>{section.label}</h2>
                <span className="text-[13px] text-muted">
                  {day[section.key].length}
                  {section.hint ? ` · ${section.hint}` : ""}
                </span>
              </div>
              {day[section.key].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  canChangeStatus
                  today={today}
                  t={taskT}
                  showAssignee={false}
                  editHref={canOpenTasks ? `/customers/${task.customerId}?tab=tasks&date=${task.dueDate}&edit=${task.id}` : undefined}
                  onError={onError}
                />
              ))}
            </section>
          ))}
          {visible.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-4 py-9 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-mint text-teal-deep">{icon("M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8.5 12l2.5 2.5 4.5-5")}</span>
              <span className="text-lg font-semibold">{t.emptyTitle}</span>
              <span className="text-sm text-muted">{t.emptyHint}</span>
            </div>
          )}
        </div>

        <PersonalTasks key={date} date={date} items={personal} t={t} taskT={taskT} errors={errors} onError={onError} onAdded={() => show(t.added)} />
      </main>
      <Toast message={message} />
    </div>
  );
}

function PersonalTasks({
  date,
  items,
  t,
  taskT,
  errors,
  onError,
  onAdded,
}: {
  date: string;
  items: PersonalTask[];
  t: T;
  taskT: TaskT;
  errors: Dictionary["errors"];
  onError: (key: string) => void;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const formBox = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [reminders, setReminders] = useState<number[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useFlip(box);

  const save = () =>
    startTransition(async () => {
      const result = await addPersonalTask({ date, title, note, time: time || null, reminders });
      if (!result.ok) return setProblem(result.error);
      setTitle("");
      setNote("");
      setTime("");
      setReminders([]);
      setProblem(null);
      setAdding(false);
      onAdded();
    });
  const field = "h-12 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 text-[15px] font-normal";
  const chip = (on: boolean) =>
    `flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-[13px] font-semibold transition-colors duration-200 ${on ? "border-teal bg-teal-tint" : "border-transparent bg-surface hover:bg-mint-soft"}`;

  return (
    <section aria-label={t.personal} className="flex flex-col gap-4 rounded-[28px] bg-surface p-4 sm:p-[22px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-[1_1_240px] flex-col gap-1">
          <h2 className="text-base font-semibold">{t.personal}</h2>
          <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            {icon("M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4", 16)}
            {t.personalHint}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={adding}
          onClick={() => {
            setAdding((v) => !v);
            if (!adding) setTimeout(() => scrollIntoViewSoftly(formBox.current, "center"), 60);
          }}
          className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-sun px-4 text-sm font-semibold"
        >
          {icon(adding ? "M6 6l12 12M18 6 6 18" : "M12 5v14M5 12h14", 16)}
          {t.add}
        </button>
      </div>

      <Collapse open={adding}>
        <div ref={formBox} className="scroll-mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-3 rounded-[22px] bg-mint p-4"
        >
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t.what}
            <input autoFocus autoComplete="off" maxLength={200} value={title} onChange={(e) => { setTitle(e.target.value); setProblem(null); }} className={field} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5 text-[13px] font-semibold">
              {t.note}
              <input autoComplete="off" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
            </label>
            <label className="flex w-[150px] flex-col gap-1.5 text-[13px] font-semibold">
              {t.time}
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <span id="personal-remind" className="text-[13px] font-semibold">{t.remindMe}</span>
            <div role="group" aria-labelledby="personal-remind" className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!reminders.length} onClick={() => setReminders([])} className={chip(!reminders.length)}>
                {t.remindNone}
              </button>
              {PERSONAL_REMINDERS.map((m) => {
                const on = reminders.includes(m);
                const label = m === 0 ? t.remindAt : m === 15 ? t.remind15 : m === 60 ? t.remind60 : t.remind1440;
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => setReminders((list) => (on ? list.filter((x) => x !== m) : [...list, m]))} className={chip(on)}>
                    {on && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="zk-pop"><path d="m5 12 5 5L20 7" /></svg>}
                    {label}
                  </button>
                );
              })}
            </div>
            {reminders.length > 0 && !time && <span className="text-xs text-ink-soft">{t.remindNoTime}</span>}
          </div>
          <p role={problem ? "alert" : undefined} className={`text-[13px] ${problem ? "text-danger" : "text-ink-soft"}`}>
            {problem ? (errors[problem as ErrorKey] ?? errors.generic) : fill(t.addsTo, { date: shortDate(date, taskT) })}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-sun px-5 text-sm font-semibold">{t.save}</button>
            <button type="button" onClick={() => { setAdding(false); setProblem(null); }} className="min-h-11 rounded-full bg-surface px-5 text-sm font-semibold">{t.cancel}</button>
          </div>
        </form>
        </div>
      </Collapse>

      <div ref={box} className="flex flex-col gap-2">
        {items.map((p) => (
          <PersonalRow key={p.id} item={p} date={date} t={t} taskT={taskT} onError={onError} />
        ))}
        {items.length === 0 && <p className="text-sm text-muted">{t.none}</p>}
      </div>
    </section>
  );
}

function PersonalRow({ item, date, t, taskT, onError }: { item: PersonalTask; date: string; t: T; taskT: TaskT; onError: (key: string) => void }) {
  const [isDone, setDone] = useOptimistic(item.done);
  const [, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      setDone(!isDone);
      const result = await setPersonalDone(item.id, !isDone);
      if (!result.ok) onError(result.error);
    });
  const remove = () =>
    startTransition(async () => {
      const result = await deletePersonalTask(item.id);
      if (!result.ok) onError(result.error);
    });
  const sub = [item.note, item.dueDate < date ? fill(t.from, { date: shortDate(item.dueDate, taskT) }) : ""].filter(Boolean).join(" · ");
  const timing = (item.time || item.reminders.length > 0) && (
    <span className="flex shrink-0 items-center gap-1.5">
      {item.time && <span className="rounded-full bg-mint px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">{item.time}</span>}
      {item.reminders.length > 0 && (
        <span title={t.hasReminder} aria-label={t.hasReminder} className="flex size-6 items-center justify-center rounded-full bg-sun-tint text-sun-ink">
          {icon("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0", 13)}
        </span>
      )}
    </span>
  );
  return (
    <div data-flip={item.id} className={`flex min-h-[52px] items-center gap-1 rounded-[18px] border-[1.5px] border-dashed border-subtle pr-1.5 transition-colors duration-300 ${isDone ? "bg-done" : "bg-surface"}`}>
      <button type="button" aria-pressed={isDone} onClick={toggle} className="flex min-h-[50px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5 text-left">
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-[1.5px] text-white transition-colors duration-200 ${isDone ? "border-teal bg-teal" : "border-subtle bg-surface"}`}>
          {isDone && (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="zk-pop">
              <path d="m5 12 5 5L20 7" />
            </svg>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-[15px] font-semibold decoration-[1.5px] transition-colors ${isDone ? "text-ink-soft line-through" : ""}`}>{item.title}</span>
          {sub && <span className="text-[13px] text-ink-soft">{sub}</span>}
        </span>
        {timing}
      </button>
      <button type="button" aria-label={fill(t.remove, { title: item.title })} title={fill(t.remove, { title: item.title })} onClick={remove} className="flex size-10 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
        {icon("M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6", 18)}
      </button>
    </div>
  );
}
