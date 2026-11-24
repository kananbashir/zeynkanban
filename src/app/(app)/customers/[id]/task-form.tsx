"use client";

import { PinIcon } from "@/components/content-note";

import { Collapse } from "@/components/motion";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createTask, loadDay, loadMonthCounts, setTaskArchived, updateTask } from "@/app/actions/tasks";
import { CloseButton, Dialog } from "@/components/dialog";
import { MiniCalendar } from "@/components/mini-calendar";
import { TaskTypeIcon } from "@/components/task-type-icon";
import { avatarColor } from "@/components/task-card";
import { initials } from "@/components/top-bar";
import { btn, field } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { addDays, daysBetween, isIsoDateString, monthGrid, monthOf, shiftMonth, specialDaysOn, type SpecialDay } from "@/lib/dates";
import { dayLabel, shortDate } from "@/lib/format-date";
import { DEFAULT_REMIND_TIME, REMIND_DAYS, reminderDate } from "@/lib/reminder-rules";
import { countPerDay, groupByPerson, taskEnd } from "@/lib/task-rules";
import type { TaskView } from "@/lib/tasks";

/** `note`: the note on the content ID, shown under it when it is picked. */
export type FormContent = { id: string; code: string; typeName: string; publishDate: string | null; note?: string | null };
export type FormType = { id: string; name: string; icon?: string };
export type FormPerson = { id: string; name: string };

/** Quick deadline choices: days after the task's day (0 = the same day, i.e. no deadline). */
const DEADLINE_STEPS = [0, 1, 2, 3, 7];
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
  defaultContentId,
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
  /** A new task starts with this content ID picked. */
  defaultContentId?: string;
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
  const [contentId, setContentId] = useState(task?.contentId ?? defaultContentId ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees.map((p) => p.id) ?? []);
  const [date, setDate] = useState(task?.dueDate ?? defaultDate);
  // Days from the task's day to its deadline (0: no deadline, due that same day). Kept when the day
  // changes, so moving the task moves its deadline with it.
  const [span, setSpan] = useState(task?.deadline ? daysBetween(task.dueDate, task.deadline) : 0);
  const deadline = span > 0 ? addDays(date, span) : null;
  const end = deadline ?? date;
  const [description, setDescription] = useState(task?.description ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [remindDays, setRemindDays] = useState<number[]>(task?.remindDays ?? []);
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
    for (const day of Object.keys(countPerDay([task], task.dueDate, taskEnd(task), addDays))) if (copy[day]) copy[day] -= 1;
    return copy;
  }, [counts, task]);

  const groups = useMemo(() => groupByPerson(dayList), [dayList]);
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
      assigneeIds,
      dueDate: date,
      deadline,
      description,
      note,
      remindDays,
      remindTime,
    };
    startTransition(async () => {
      const result = task ? await updateTask(task.id, input) : await createTask(input);
      if (!result.ok) return setError(errors[result.error]);
      onSaved(date, assigneeIds.length ? fill(f.saved, { date: dayLabel(date, fmt, currentYear) }) : f.savedDraft);
    });
  }

  const card = "flex flex-col gap-3 rounded-[20px] bg-surface p-4";
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
                {[...types, { id: OTHER, name: f.other, icon: undefined }].map((x) => (
                  <button key={x.id} type="button" aria-pressed={typeId === x.id} onClick={() => setTypeId(x.id)} className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold ${pick(typeId === x.id)}`}>
                    {x.icon && <TaskTypeIcon name={x.icon} size={16} className="text-teal-deep" />}
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
                      <span className="whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{c.typeName}</span>
                      <span className="ml-auto whitespace-nowrap text-xs text-ink-soft">{c.publishDate ? fill(f.publishes, { date: shortDate(c.publishDate, t) }) : f.noPublish}</span>
                      {c.note && (
                        <Collapse open={contentId === c.id} className="basis-full">
                          <span className="flex items-start gap-1.5 text-[12.5px] leading-snug text-sun-ink">
                            <PinIcon size={13} className="mt-px" />
                            <span className="line-clamp-3 whitespace-pre-line">{c.note}</span>
                          </span>
                        </Collapse>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h3 id="f-who" className="text-[15px] font-semibold">{f.assignee}</h3>
                <span className="text-xs text-muted">{f.assigneeHint}</span>
              </div>
              <div role="group" aria-labelledby="f-who" className="grid gap-2 sm:grid-cols-2">
                {people.map((p) => {
                  const n = dayList.filter((x) => x.assignees.some((a) => a.id === p.id)).length;
                  const on = assigneeIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAssigneeIds((list) => (on ? list.filter((x) => x !== p.id) : [...list, p.id]))}
                      className={`flex min-h-[52px] items-center gap-2.5 rounded-2xl border-2 px-3 py-1.5 text-left transition-colors duration-200 ${pick(on)}`}
                    >
                      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: avatarColor(p.id) }}>
                        {initials(p.name)}
                        {on && (
                          <span className="zk-pop absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border-2 border-surface bg-teal">
                            <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
                          </span>
                        )}
                      </span>
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
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h3 id="task-reminder" className="text-[15px] font-semibold">{f.reminder}</h3>
                <span className="text-xs text-muted">{f.reminderHint}</span>
              </div>
              <div role="group" aria-labelledby="task-reminder" className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={!remindDays.length} onClick={() => setRemindDays([])} className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors duration-200 ${pick(!remindDays.length)}`}>
                  {f.remindNever}
                </button>
                {REMIND_DAYS.map((n) => {
                  const on = remindDays.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setRemindDays((list) => (on ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b)))}
                      className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold transition-colors duration-200 ${pick(on)}`}
                    >
                      {on && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="zk-pop"><path d="m5 12 5 5L20 7" /></svg>}
                      {n === 1 ? f.remind1 : fill(f.remindN, { n })}
                    </button>
                  );
                })}
              </div>
              {remindDays.length > 0 && (
                <div className="zk-fade-up flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex items-center gap-2.5 text-[13px] font-semibold">
                    {f.remindTime}
                    <input type="time" required value={remindTime} onChange={(e) => setRemindTime(e.target.value || DEFAULT_REMIND_TIME)} className={`${field} w-[132px]`} />
                  </label>
                  <p className="min-w-0 flex-[1_1_220px] text-[13px] leading-snug text-ink-soft">
                    {!assigneeIds.length
                      ? f.remindNoAssignee
                      : remindDays.some((n) => reminderDate(end, n) < today) && remindDays.every((n) => reminderDate(end, n) <= today)
                        ? f.remindPassed
                        : fill(f.remindHint, {
                            name: assigneeIds.map((id) => people.find((p) => p.id === id)?.name ?? "").filter(Boolean).join(", "),
                            date: [...remindDays]
                              .sort((a, b) => b - a)
                              .filter((n) => reminderDate(end, n) >= today)
                              .map((n) => dayLabel(reminderDate(end, n), fmt, currentYear))
                              .join(f.and),
                            time: remindTime,
                          })}
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
                rangeEnd={deadline}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
                <span>{f.legendLoad}</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-event bg-sun-tint" />{t.calendarEvent}</span>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-line pt-3.5">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <h3 id="task-deadline" className="text-[15px] font-semibold">{f.deadline}</h3>
                  <span className="text-xs text-muted">{f.deadlineHint}</span>
                </div>
                <div role="group" aria-labelledby="task-deadline" className="flex flex-wrap items-center gap-2">
                  {DEADLINE_STEPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={span === n}
                      onClick={() => setSpan(n)}
                      className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors duration-200 ${pick(span === n)}`}
                    >
                      {n === 0 ? f.deadlineSame : n === 7 ? f.deadlineWeek : n === 1 ? f.deadlinePlus1 : fill(f.deadlinePlusN, { n })}
                    </button>
                  ))}
                  <label className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold">
                    {f.deadlineOther}
                    <input
                      type="date"
                      aria-label={f.deadlineDate}
                      min={date}
                      value={end}
                      onChange={(e) => isIsoDateString(e.target.value) && setSpan(Math.max(0, daysBetween(date, e.target.value)))}
                      className={`${field} w-[164px]`}
                    />
                  </label>
                </div>
                <p className="text-[13px] text-ink-soft">
                  {deadline ? fill(f.deadlineSpan, { from: dayLabel(date, fmt, currentYear), to: dayLabel(deadline, fmt, currentYear) }) : fill(f.deadlineNone, { date: dayLabel(date, fmt, currentYear) })}
                </p>
              </div>
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="flex-1 text-[15px] font-semibold">
                  {dayList.length ? fill(f.dayLoad, { date: dayLabel(date, fmt, currentYear), n: dayList.length === 1 ? t.task1 : fill(t.tasksN, { n: dayList.length }) }) : fill(f.dayNone, { date: dayLabel(date, fmt, currentYear) })}
                </h3>
                {events.map((e) => <span key={e.name} className="text-[13px] font-semibold text-sun-ink">{e.name}</span>)}
              </div>
              {groups.map(({ id: personId, name: personName, list }) => {
                const person = people.find((p) => p.id === personId);
                return (
                  <div key={personId || "none"} className="flex flex-col gap-1.5 border-t border-line pt-3">
                    <div className="flex items-center gap-2.5">
                      {personId ? (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatarColor(personId) }}>{initials(person?.name ?? personName)}</span>
                      ) : (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-subtle text-[11px] font-bold text-muted">?</span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{personId ? (person?.name ?? personName) : t.customer.noAssigneeGroup}</span>
                      <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-muted">{list.length}</span>
                    </div>
                    {/* Wide: three aligned columns (content ID · type · customer). Phone: a small tile per task. */}
                    <div className="flex flex-col gap-1.5 sm:gap-0">
                      {list.map((x) => (
                        <div
                          key={x.id}
                          className={`flex items-center gap-3 rounded-[12px] px-2.5 py-2 sm:grid sm:grid-cols-[176px_minmax(0,1fr)_minmax(0,160px)] sm:rounded-none sm:border-t sm:border-line sm:bg-transparent sm:px-1 sm:first:border-t-0 ${personId ? "bg-mint-soft" : "border-[1.5px] border-dashed border-line-strong sm:border-x-0 sm:border-b-0 sm:border-solid"}`}
                        >
                          <span data-code className="order-2 ml-auto shrink-0 whitespace-nowrap rounded-[7px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px] font-medium text-ink sm:order-first sm:ml-0 sm:justify-self-start">{x.contentCode}</span>
                          <span className="order-1 flex min-w-0 flex-1 flex-col sm:contents">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <TaskTypeIcon name={x.typeIcon} size={15} className="text-teal-deep" />
                              <span data-type className="truncate text-[13.5px] font-semibold text-ink">{x.typeName}</span>
                            </span>
                            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted sm:text-[12.5px]">
                              <span className="size-2 shrink-0 rounded-full border-[1.5px] border-black/20" style={{ background: x.customerColor }} />
                              <span data-customer className="truncate">{x.customerName}</span>
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
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
            {error ?? (assigneeIds.length ? (task ? "" : fill(f.hintStart, { status: firstStatus })) : f.hintDraft)}
          </p>
          <button type="button" className={`${btn.soft} min-h-12 px-[22px] text-[15px]`} onClick={onClose}>{f.cancel}</button>
          <button type="submit" className={`${btn.primary} min-h-12 px-[26px] text-[15px]`} disabled={pending}>
            {task ? f.saveChanges : assigneeIds.length ? f.saveTask : f.saveDraft}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
