"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createTask, loadDay, loadMonthCounts, setTaskArchived, updateTask } from "@/app/actions/tasks";
import { CloseButton, Dialog } from "@/components/dialog";
import { MiniCalendar } from "@/components/mini-calendar";
import { avatarColor } from "@/components/task-card";
import { initials } from "@/components/top-bar";
import { btn, field } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { monthGrid, monthOf, shiftMonth, specialDaysOn, type SpecialDay } from "@/lib/dates";
import { dayLabel, shortDate } from "@/lib/format-date";
import { DEFAULT_REMIND_TIME, REMIND_DAYS, reminderDate } from "@/lib/reminder-rules";
import type { TaskView } from "@/lib/tasks";

export type FormContent = { id: string; code: string; typeName: string; publishDate: string | null };
export type FormType = { id: string; name: string };
export type FormPerson = { id: string; name: string };

const OTHER = "__other";
const pick = (on: boolean) => (on ? "border-teal bg-teal-tint" : "border-transparent bg-mint-soft hover:bg-mint");

/** Add or edit a task: type, content ID, assignee, details, and a calendar showing how busy each day already is. */
export function TaskForm({
  customerId,
  customerName,
  contents,
  types,
  people,
  firstStatus,
  specialDays,
  today,
  defaultDate,
  task,
  canArchive,
  t,
  months,
  errors,
  onClose,
  onSaved,
  onNewContent,
}: {
  customerId: string;
  customerName: string;
  contents: FormContent[];
  types: FormType[];
  people: FormPerson[];
  firstStatus: string;
  specialDays: SpecialDay[];
  today: string;
  defaultDate: string;
  task: TaskView | null;
  canArchive: boolean;
  t: Dictionary["tasks"];
  months: readonly string[];
  errors: Dictionary["errors"];
  onClose: () => void;
  onSaved: (date: string, message: string) => void;
  onNewContent: () => void;
}) {
  const f = t.form;
  const knownType = task && types.some((x) => x.id === task.taskTypeId);
  const [typeId, setTypeId] = useState<string>(task ? (knownType ? task.taskTypeId : OTHER) : "");
  const [typeName, setTypeName] = useState(task && !knownType ? task.typeName : "");
  const [saveType, setSaveType] = useState(false);
  const [contentId, setContentId] = useState(task?.contentId ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(task?.assigneeId ?? "");
  const [date, setDate] = useState(task?.dueDate ?? defaultDate);
  const [description, setDescription] = useState(task?.description ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [remindDays, setRemindDays] = useState<number | null>(task?.remindDays ?? null);
  const [remindTime, setRemindTime] = useState(task?.remindTime ?? DEFAULT_REMIND_TIME);
  const [shown, setShown] = useState(monthOf(task?.dueDate ?? defaultDate));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dayList, setDayList] = useState<TaskView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fmt = { ...t, months };

  // The task's own content ID stays selectable even if it has been archived since.
  const contentOptions = useMemo(() => {
    if (!task || contents.some((c) => c.id === task.contentId)) return contents;
    return [{ id: task.contentId, code: task.contentCode, typeName: task.typeName, publishDate: null }, ...contents];
  }, [contents, task]);

  useEffect(() => {
    let live = true;
    const grid = monthGrid(shown.year, shown.month);
    loadMonthCounts(grid[0].iso, grid[grid.length - 1].iso).then((c) => live && setCounts(c));
    return () => {
      live = false;
    };
  }, [shown]);

  useEffect(() => {
    let live = true;
    loadDay(date).then((list) => live && setDayList(list.filter((x) => x.id !== task?.id)));
    return () => {
      live = false;
    };
  }, [date, task?.id]);

  // Calendar numbers leave this task itself out, so they show the load *besides* it.
  const shownCounts = useMemo(() => {
    if (!task) return counts;
    const copy = { ...counts };
    if (copy[task.dueDate]) copy[task.dueDate] -= 1;
    return copy;
  }, [counts, task]);

  const groups = useMemo(() => {
    const byPerson = new Map<string, TaskView[]>();
    for (const x of dayList) byPerson.set(x.assigneeId ?? "", [...(byPerson.get(x.assigneeId ?? "") ?? []), x]);
    return [...byPerson.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : b[1].length - a[1].length));
  }, [dayList]);
  const events = specialDaysOn(date, specialDays);
  const currentYear = Number(today.slice(0, 4));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!typeId) return setError(errors.typeRequired);
    if (!contentId) return setError(errors.contentRequired);
    const input = {
      customerId,
      contentId,
      taskTypeId: typeId === OTHER ? null : typeId,
      typeName: typeId === OTHER ? typeName : undefined,
      saveType,
      assigneeId: assigneeId || null,
      dueDate: date,
      description,
      note,
      remindDays,
      remindTime,
    };
    startTransition(async () => {
      const result = task ? await updateTask(task.id, input) : await createTask(input);
      if (!result.ok) return setError(errors[result.error]);
      onSaved(date, assigneeId ? fill(f.saved, { date: dayLabel(date, fmt, currentYear) }) : f.savedDraft);
    });
  }

  const card = "flex flex-col gap-3 rounded-[20px] bg-white p-4";
  return (
    <Dialog label={task ? f.editTitle : f.addTitle} onClose={onClose} wide>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[13px] font-semibold text-teal-deep">{customerName}</span>
            <h2 className="text-2xl font-semibold">{task ? f.editTitle : f.addTitle}</h2>
          </div>
          <CloseButton label={f.close} onClick={onClose} />
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
            <section className={card}>
              <h3 id="f-type" className="text-[15px] font-semibold">{f.type}</h3>
              <div role="group" aria-labelledby="f-type" className="flex flex-wrap gap-2">
                {[...types, { id: OTHER, name: f.other }].map((x) => (
                  <button key={x.id} type="button" aria-pressed={typeId === x.id} onClick={() => setTypeId(x.id)} className={`min-h-11 whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold ${pick(typeId === x.id)}`}>
                    {x.name}
                  </button>
                ))}
              </div>
              {typeId === OTHER && (
                <div className="flex flex-col gap-2.5">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {f.typeName}
                    <input className={field} value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder={f.typeNamePlaceholder} maxLength={60} autoComplete="off" />
                  </label>
                  {canArchive && (
                    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm">
                      <input type="checkbox" checked={saveType} onChange={(e) => setSaveType(e.target.checked)} className="size-5 accent-teal" />
                      {f.saveType}
                    </label>
                  )}
                </div>
              )}
            </section>

            <section className={card}>
              <div className="flex items-center gap-2">
                <h3 id="f-content" className="flex-1 text-[15px] font-semibold">{f.content}</h3>
                <button type="button" onClick={onNewContent} className="min-h-9 px-1 text-[13px] font-semibold text-teal-deep underline">{f.newContent}</button>
              </div>
              {contentOptions.length === 0 ? (
                <p className="text-sm text-ink-soft">{f.noContents}</p>
              ) : (
                <div role="group" aria-labelledby="f-content" className="flex max-h-[236px] flex-col gap-1.5 overflow-y-auto p-0.5">
                  {contentOptions.map((c) => (
                    <button key={c.id} type="button" aria-pressed={contentId === c.id} onClick={() => setContentId(c.id)} className={`flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[14px] border-2 px-3 py-1.5 text-left ${pick(contentId === c.id)}`}>
                      <span className="font-mono text-[13px] font-medium">{c.code}</span>
                      <span className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-semibold">{c.typeName}</span>
                      <span className="ml-auto whitespace-nowrap text-xs text-ink-soft">{c.publishDate ? fill(f.publishes, { date: shortDate(c.publishDate, t) }) : f.noPublish}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className={card}>
              <h3 id="f-who" className="text-[15px] font-semibold">{f.assignee}</h3>
              <div role="group" aria-labelledby="f-who" className="grid gap-2 sm:grid-cols-2">
                {people.map((p) => {
                  const n = dayList.filter((x) => x.assigneeId === p.id).length;
                  const on = assigneeId === p.id;
                  return (
                    <button key={p.id} type="button" aria-pressed={on} onClick={() => setAssigneeId(on ? "" : p.id)} className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl border-2 px-3 py-1.5 text-left ${pick(on)}`}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: avatarColor(p.id) }}>{initials(p.name)}</span>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-semibold">{p.name}</span>
                        <span className="text-xs text-ink-soft">{n ? fill(f.tasksThatDay, { n: n === 1 ? t.task1 : fill(t.tasksN, { n }) }) : f.freeThatDay}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={card}>
              <h3 className="text-[15px] font-semibold">{f.details}</h3>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                {f.description}
                <textarea className={`${field} h-24 py-3`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                {f.note}
                <input className={field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoComplete="off" />
              </label>
            </section>

            <section className={card}>
              <h3 id="task-reminder" className="text-[15px] font-semibold">{f.reminder}</h3>
              <div role="group" aria-labelledby="task-reminder" className="flex flex-wrap gap-2">
                {[null, ...REMIND_DAYS].map((n) => {
                  const on = remindDays === n;
                  return (
                    <button key={n ?? 0} type="button" aria-pressed={on} onClick={() => setRemindDays(n)} className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors duration-200 ${pick(on)}`}>
                      {n === null ? f.remindNever : n === 1 ? f.remind1 : fill(f.remindN, { n })}
                    </button>
                  );
                })}
              </div>
              {remindDays !== null && (
                <div className="zk-fade-up flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2.5 text-[13px] font-semibold">
                    {f.remindTime}
                    <input type="time" required value={remindTime} onChange={(e) => setRemindTime(e.target.value || DEFAULT_REMIND_TIME)} className={`${field} w-[132px]`} />
                  </label>
                  <p className="min-w-0 flex-[1_1_220px] text-[13px] leading-snug text-ink-soft">
                    {!assigneeId
                      ? f.remindNoAssignee
                      : reminderDate(date, remindDays) < today
                        ? f.remindPassed
                        : fill(f.remindHint, { name: people.find((p) => p.id === assigneeId)?.name ?? "", date: dayLabel(reminderDate(date, remindDays), fmt, currentYear), time: remindTime })}
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
            <section className={card} aria-label={f.date}>
              <MiniCalendar
                year={shown.year}
                month={shown.month}
                selected={date}
                today={today}
                counts={shownCounts}
                specialDays={specialDays}
                months={months}
                weekdaysShort={t.weekdaysShort}
                prevLabel={t.prevMonth}
                nextLabel={t.nextMonth}
                onPick={setDate}
                onMonth={(delta) => setShown(shiftMonth(shown.year, shown.month, delta))}
                showCounts
                cellHeight={48}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
                <span>{f.legendLoad}</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-[#b87a00] bg-sun-tint" />{t.calendarEvent}</span>
              </div>
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="flex-1 text-[15px] font-semibold">
                  {dayList.length ? fill(f.dayLoad, { date: dayLabel(date, fmt, currentYear), n: dayList.length === 1 ? t.task1 : fill(t.tasksN, { n: dayList.length }) }) : fill(f.dayNone, { date: dayLabel(date, fmt, currentYear) })}
                </h3>
                {events.map((e) => <span key={e.name} className="text-[13px] font-semibold text-sun-ink">{e.name}</span>)}
              </div>
              {groups.map(([personId, list]) => {
                const person = people.find((p) => p.id === personId);
                return (
                  <div key={personId || "none"} className="flex flex-col gap-1.5 border-t border-line pt-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: personId ? avatarColor(personId) : "#6b7785" }}>{personId ? initials(person?.name ?? list[0].assigneeName ?? "?") : "?"}</span>
                      <span className="flex-1 text-sm font-semibold">{personId ? (person?.name ?? list[0].assigneeName) : t.customer.noAssigneeGroup}</span>
                      <span className="text-xs text-ink-soft">{list.length === 1 ? t.task1 : fill(t.tasksN, { n: list.length })}</span>
                    </div>
                    {list.map((x) => (
                      <div key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-8 text-[13px] text-ink-soft">
                        <span className="flex-[1_1_120px] font-medium text-ink">{x.typeName}</span>
                        <span className="flex items-center gap-1.5"><span className="size-[9px] rounded-full border-[1.5px] border-black/25" style={{ background: x.customerColor }} />{x.customerName}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {groups.length === 0 && <p className="text-[13px] text-muted">{f.nothingElse}</p>}
            </section>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {task && canArchive && (
            <button
              type="button"
              className={btn.soft}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setTaskArchived(task.id, true);
                  if (!result.ok) return setError(errors[result.error]);
                  onSaved(task.dueDate, f.archived);
                })
              }
            >
              {f.archive}
            </button>
          )}
          <p role={error ? "alert" : undefined} className={`flex-[1_1_260px] text-sm font-medium leading-snug ${error ? "text-danger" : "text-ink-soft"}`}>
            {error ?? (assigneeId ? (task ? "" : fill(f.hintStart, { status: firstStatus })) : f.hintDraft)}
          </p>
          <button type="button" className={`${btn.soft} min-h-12 px-[22px] text-[15px]`} onClick={onClose}>{f.cancel}</button>
          <button type="submit" className={`${btn.primary} min-h-12 px-[26px] text-[15px]`} disabled={pending}>
            {task ? f.saveChanges : assigneeId ? f.saveTask : f.saveDraft}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
