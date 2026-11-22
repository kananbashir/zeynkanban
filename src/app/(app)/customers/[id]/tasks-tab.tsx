"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { loadDay } from "@/app/actions/tasks";
import { CloseButton, Dialog } from "@/components/dialog";
import { MiniCalendar } from "@/components/mini-calendar";
import { DaySwitcher, EventChips, lineButton } from "@/components/day-header";
import { useFlip } from "@/components/motion";
import { avatarColor, TaskCard, type StatusOption } from "@/components/task-card";
import { Toast, useToast } from "@/components/toast";
import { initials } from "@/components/top-bar";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { shiftMonth, specialDaysOn, type SpecialDay } from "@/lib/dates";
import { dayLabel, longDate } from "@/lib/format-date";
import { groupByPerson, type Section } from "@/lib/task-rules";
import type { DayTasks, TaskView } from "@/lib/tasks";
import { PlanMonth, type PlanContent, type PlanPeriod, type PlanType } from "./plan-month";
import { TaskForm, type FormContent, type FormPerson, type FormType } from "./task-form";

export function TasksTab({
  customerId,
  customerName,
  date,
  today,
  shownMonth,
  day,
  drafts,
  counts,
  statuses,
  specialDays,
  contents,
  types,
  people,
  editTask,
  canArchive,
  plan,
  openPlan,
  t,
  months,
  errors,
}: {
  customerId: string;
  customerName: string;
  date: string;
  today: string;
  shownMonth: { year: number; month: number };
  day: DayTasks;
  drafts: TaskView[];
  counts: Record<string, number>;
  statuses: StatusOption[];
  specialDays: SpecialDay[];
  contents: FormContent[];
  types: FormType[];
  people: FormPerson[];
  editTask: TaskView | null;
  canArchive: boolean;
  plan: { shortName: string; contents: PlanContent[]; allCodes: string[]; periods: PlanPeriod[]; contentTypes: PlanType[] };
  openPlan: boolean;
  t: Dictionary["tasks"];
  months: readonly string[];
  errors: Dictionary["errors"];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { message, show } = useToast();
  const [form, setForm] = useState<{ task: TaskView | null } | null>(editTask ? { task: editTask } : null);
  // A task to edit arriving in the address (?edit=, e.g. from the board's Edit link) opens its form.
  // Done here rather than by remounting the tab, so the "saved" message survives dropping ?edit= afterwards.
  const [editOpened, setEditOpened] = useState(editTask?.id ?? null);
  if ((editTask?.id ?? null) !== editOpened) {
    setEditOpened(editTask?.id ?? null);
    if (editTask) setForm({ task: editTask });
  }
  const [fab, setFab] = useState(false);
  const [planning, setPlanning] = useState(openPlan);
  const [whole, setWhole] = useState<TaskView[] | null>(null);
  const fmt = { ...t, months };
  const c = t.customer;
  const isToday = date === today;
  const currentYear = Number(today.slice(0, 4));
  const list = useRef<HTMLDivElement>(null);
  useFlip(list);

  const go = (params: Record<string, string>) => {
    const search = new URLSearchParams({ tab: "tasks", date, ...params });
    router.push(`${pathname}?${search}`, { scroll: false });
  };
  const closeForm = () => {
    setForm(null);
    if (editTask) go({}); // drop ?edit= from the address
  };
  const closePlan = () => {
    setPlanning(false);
    if (openPlan) go({}); // drop ?plan= from the address
  };

  const sections: { key: Section; label: string; color: string; hint?: string }[] = [
    { key: "overdue", label: t.sections.overdue, color: "text-danger", hint: t.overdueHint },
    { key: "due", label: isToday ? t.sections.due : t.sections.dueOn, color: "text-ink" },
    { key: "finished", label: isToday ? t.sections.finished : t.sections.finishedOn, color: "text-teal-deep" },
  ];
  const visible = sections.filter((s) => day[s.key].length > 0);
  const events = specialDaysOn(date, specialDays);
  const onError = (key: string) => show(errors[key as ErrorKey] ?? errors.generic, "error");

  const groups = whole ? groupByPerson(whole) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-5">
        <section aria-label={t.calendarTasks} className="w-full rounded-[28px] bg-surface px-5 pb-[18px] pt-[22px] lg:w-[320px] lg:shrink-0">
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
        </section>

        <div ref={list} className="flex min-w-0 flex-[999_1_480px] flex-col gap-[22px] rounded-[28px] bg-surface p-4 sm:p-[22px]">
          <div className="flex flex-col gap-2.5">
            <DaySwitcher date={date} today={today} onGo={(iso) => go({ date: iso })} t={t} months={months} heading="h2" titleClass="text-lg sm:text-[22px]" />
            <div className="flex flex-wrap items-center gap-2">
              <EventChips events={events} t={t} />
              <button type="button" onClick={() => loadDay(date).then(setWhole)} className={`${lineButton} ml-auto`}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                {c.wholeDay}
              </button>
            </div>
          </div>

          {visible.map((section) => (
            <section key={section.key} className="flex flex-col gap-3">
              <div data-flip={`heading-${section.key}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h3 className={`text-base font-semibold ${section.color}`}>{section.label}</h3>
                <span className="text-[13px] text-muted">{day[section.key].length}{section.hint ? ` · ${section.hint}` : ""}</span>
              </div>
              {day[section.key].map((task) => (
                <TaskCard key={task.id} task={task} statuses={statuses} canChangeStatus today={today} t={t} showCustomer={false} onEdit={() => setForm({ task })} onError={onError} />
              ))}
            </section>
          ))}
          {visible.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-4 py-9 text-center">
              <span className="text-lg font-semibold">{c.emptyDay}</span>
              <span className="text-sm text-muted">{c.emptyDayHint}</span>
            </div>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <section aria-label={c.drafts} className="flex flex-col gap-3.5 rounded-[28px] bg-surface p-4 sm:p-[22px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="flex-1 text-base font-semibold">{fill(c.drafts, { n: drafts.length })}</h3>
            <span className="text-[13px] text-muted">{c.draftsHint}</span>
          </div>
          <div className="flex flex-col gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-[18px] border-[1.5px] border-dashed border-subtle py-2 pl-3.5 pr-2">
                <span className="rounded-lg bg-mint px-2 py-1 font-mono text-xs font-medium">{d.contentCode}</span>
                <span className="text-sm font-semibold">{d.typeDeleted ? fill(t.deletedType, { name: d.typeName }) : d.typeName}</span>
                <span className="text-[13px] text-ink-soft">{dayLabel(d.dueDate, fmt, currentYear)}</span>
                <button type="button" onClick={() => setForm({ task: d })} className="ml-auto min-h-10 whitespace-nowrap rounded-full bg-mint px-3.5 text-[13px] font-semibold">{c.addDetails}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] z-20 lg:bottom-[max(28px,env(safe-area-inset-bottom))] flex flex-col items-end gap-2.5">
        {fab && (
          <div className="flex flex-col items-end gap-2">
            <button type="button" onClick={() => { setFab(false); setPlanning(true); }} className="flex min-h-12 items-center gap-2.5 rounded-full bg-surface px-[18px] text-sm font-semibold shadow-[0_8px_24px_rgba(24,35,47,0.18)]">{c.planMonth}</button>
            <button type="button" onClick={() => { setFab(false); setForm({ task: null }); }} className="flex min-h-12 items-center gap-2.5 rounded-full bg-surface px-[18px] text-sm font-semibold shadow-[0_8px_24px_rgba(24,35,47,0.18)]">{c.addTask}</button>
          </div>
        )}
        <button type="button" aria-label={c.fab} aria-expanded={fab} onClick={() => setFab((v) => !v)} className="flex size-16 items-center justify-center rounded-full bg-sun text-ink shadow-[0_10px_28px_rgba(24,35,47,0.25)]">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d={fab ? "M6 6l12 12M18 6 6 18" : "M12 5v14M5 12h14"} /></svg>
        </button>
      </div>

      {form && (
        <TaskForm
          key={form.task?.id ?? "new"}
          customerId={customerId}
          customerName={customerName}
          contents={contents}
          types={types}
          people={people}
          firstStatus={statuses[0]?.name ?? ""}
          specialDays={specialDays}
          today={today}
          defaultDate={date}
          task={form.task}
          canArchive={canArchive}
          t={t}
          months={months}
          errors={errors}
          onClose={closeForm}
          onSaved={(savedDate, msg) => {
            setForm(null);
            show(msg);
            go({ date: savedDate });
          }}
          onNewContent={() => router.push(`${pathname}?tab=contents`)}
        />
      )}

      {planning && (
        <PlanMonth
          customerId={customerId}
          customerName={customerName}
          shortName={plan.shortName}
          contents={plan.contents}
          allCodes={plan.allCodes}
          periods={plan.periods}
          contentTypes={plan.contentTypes}
          specialDays={specialDays}
          today={today}
          t={t}
          months={months}
          errors={errors}
          onClose={closePlan}
          onMessage={show}
          onSaved={(msg) => {
            setPlanning(false);
            show(msg);
            if (openPlan) go({});
            else router.refresh();
          }}
        />
      )}

      {whole && (
        <Dialog label={c.wholeDayTitle} onClose={() => setWhole(null)}>
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[13px] font-semibold text-teal-deep">{c.wholeDayTitle}</span>
              <h2 className="text-2xl font-semibold">{longDate(date, fmt)}</h2>
              <span className="text-sm text-ink-soft">
                {fill(c.wholeDaySummary, { n: whole.length, c: new Set(whole.map((x) => x.customerId)).size })}
                {events.length ? ` · ${events.map((e) => e.name).join(", ")}` : ""}
              </span>
            </div>
            <CloseButton label={t.form.close} onClick={() => setWhole(null)} />
          </div>
          {groups.map(({ id, name, list }) => (
            <section key={id || "none"} className="flex flex-col rounded-[20px] bg-surface px-4 pb-1.5 pt-3.5">
              <div className="flex items-center gap-2.5 pb-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: id ? avatarColor(id) : "var(--color-subtle)" }}>{id ? initials(name) : "?"}</span>
                <h3 className="flex-1 text-[15px] font-semibold">{id ? name : c.noAssigneeGroup}</h3>
                <span className="text-[13px] text-ink-soft">{list.length === 1 ? t.task1 : fill(t.tasksN, { n: list.length })}</span>
              </div>
              {list.map((x) => (
                <div key={x.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-line py-2.5 text-[13px] text-ink-soft">
                  <span className="flex-[1_1_140px] text-sm font-semibold text-ink">{x.typeName}</span>
                  <span className="flex flex-[1_1_120px] items-center gap-1.5"><span className="size-2.5 rounded-full border-[1.5px] border-black/25" style={{ background: x.customerColor }} />{x.customerName}</span>
                  <span className="font-mono text-xs font-medium">{x.contentCode}</span>
                  <span className="flex min-w-[124px] items-center gap-1.5 whitespace-nowrap font-semibold text-ink"><span className="size-[9px] rounded-full" style={{ background: x.statusColor }} />{x.statusName}</span>
                </div>
              ))}
            </section>
          ))}
          {groups.length === 0 && <p className="rounded-[20px] bg-surface px-4 py-7 text-center text-sm text-muted">{c.nothingScheduled}</p>}
        </Dialog>
      )}
      <Toast message={message} />
    </div>
  );
}
