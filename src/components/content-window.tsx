"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadContentOverview, type ContentOverview } from "@/app/actions/content-overview";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { daysBetween, weekdayIndex } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { taskEnd } from "@/lib/task-rules";
import type { TaskView } from "@/lib/tasks";
import { personColor } from "./avatar-group";
import { BriefTag, BriefWindow } from "./content-brief";
import { PinIcon } from "./content-note";
import { CloseButton } from "./dialog";
import { FinishedTag, FinishedWindow } from "./finished-work";
import { Collapse } from "./motion";
import { Sheet, useSheetClose } from "./sheet";
import { TaskTypeIcon } from "./task-type-icon";
import { initials } from "./top-bar";

type T = Dictionary["tasks"];

const lateDays = (task: TaskView, today: string) => {
  const end = taskEnd(task);
  return !task.finished && !task.cancelled && !task.postponed && !task.archived && end < today ? daysBetween(end, today) : 0;
};

/**
 * Everything about a content ID in one window: details, note, brief and finished work, progress,
 * a timeline of its tasks and all its tasks in date order (the one it was opened from outlined).
 * Tapping a task opens its day on the customer page.
 */
export function ContentWindow({ contentId, fromTask, onClose, t }: { contentId: string; fromTask?: string; onClose: () => void; t: T }) {
  const w = t.contentWindow;
  const [data, setData] = useState<ContentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    let alive = true;
    loadContentOverview(contentId).then((result) => {
      if (!alive) return;
      if (!result.ok) return setError(t.brief.errors.generic);
      setData(result.overview);
    });
    return () => {
      alive = false;
    };
  }, [contentId, t.brief.errors.generic]);

  const code = data?.code ?? "…";
  return (
    <>
      <Sheet
        label={`${w.eyebrow} · ${code}`}
        onClose={onClose}
        header={<Header data={data} code={code} t={t} />}
        footer={data ? <Footer data={data} t={t} /> : undefined}
      >
        {!data && !error && <p className="py-8 text-center text-sm text-muted">{w.loading}</p>}
        {error && (
          <p role="alert" className="py-4 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {data && <Body data={data} fromTask={fromTask} t={t} openBrief={() => setBrief(true)} openFinished={() => setFinished(true)} />}
      </Sheet>
      {brief && <BriefWindow contentId={contentId} startEditing={false} onClose={() => setBrief(false)} t={t} />}
      {finished && <FinishedWindow contentId={contentId} onClose={() => setFinished(false)} t={t} />}
    </>
  );
}

function Header({ data, code, t }: { data: ContentOverview | null; code: string; t: T }) {
  const close = useSheetClose();
  const w = t.contentWindow;
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-teal-deep">{w.eyebrow}</span>
        <h2 className="break-all font-mono text-xl font-semibold sm:text-2xl">{code}</h2>
        {data && (
          <span className="text-[13px] text-ink-soft">
            {[data.customerName, data.typeName, data.period && fill(w.contract, { period: data.period })].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <CloseButton label={w.close} onClick={close} />
    </div>
  );
}

function Footer({ data, t }: { data: ContentOverview; t: T }) {
  const close = useSheetClose();
  const router = useRouter();
  const w = t.contentWindow;
  return (
    <>
      <span className="flex-1" />
      <button type="button" onClick={close} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
        {w.close}
      </button>
      {data.canAdd && (
        <button
          type="button"
          onClick={() => {
            close();
            router.push(`/customers/${data.customerId}?tab=tasks&date=${data.today}&add=${data.contentId}`);
          }}
          className="flex min-h-12 items-center gap-1.5 rounded-full bg-sun px-5 text-[15px] font-semibold text-ink"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          {w.add}
        </button>
      )}
    </>
  );
}

function Body({ data, fromTask, t, openBrief, openFinished }: { data: ContentOverview; fromTask?: string; t: T; openBrief: () => void; openFinished: () => void }) {
  const w = t.contentWindow;
  const close = useSheetClose();
  const router = useRouter();
  const [archivedOpen, setArchivedOpen] = useState(false);
  const live = data.tasks.filter((x) => !x.archived);
  const archived = data.tasks.filter((x) => x.archived);
  const done = live.filter((x) => x.finished).length;
  const go = (task: TaskView) => {
    close();
    router.push(`/customers/${data.customerId}?tab=tasks&date=${task.dueDate}&focus=${task.id}`);
  };
  const row = (task: TaskView, i: number) => (
    <TaskRow key={task.id} task={task} index={i} me={task.id === fromTask} today={data.today} t={t} onGo={() => go(task)} />
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {data.hasBrief && <BriefTag label={t.brief.tag} onOpen={openBrief} />}
        {data.hasFinishedWork && <FinishedTag f={t.finished} onOpen={openFinished} />}
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold">{data.publishDate ? fill(t.form.publishes, { date: `${t.weekdaysShort[weekdayIndex(data.publishDate)]}, ${shortDate(data.publishDate, t)}` }) : t.form.noPublish}</span>
        {live.length > 0 && (
          <span className="ml-auto flex items-center gap-2 text-[13px] text-ink-soft tabular-nums">
            <span className="flex h-[7px] w-[110px] overflow-hidden rounded-full bg-track">
              <span className="bg-teal transition-[width] duration-500" style={{ width: `${Math.round((done / live.length) * 100)}%` }} />
            </span>
            {fill(t.contents.progress, { done, total: live.length })}
          </span>
        )}
      </div>
      {data.note && (
        <div className="flex items-start gap-2 rounded-[14px] bg-sun-tint px-3 py-2.5 text-[13.5px] leading-normal text-ink-body">
          <PinIcon className="mt-0.5 text-sun-ink" />
          <p className="min-w-0 flex-1 whitespace-pre-line [overflow-wrap:anywhere]">{data.note}</p>
        </div>
      )}
      {live.length > 0 && <Timeline tasks={live} today={data.today} code={data.code} t={t} />}
      <ul aria-label={fill(w.tasksOf, { code: data.code })} className="flex flex-col rounded-[20px] bg-surface p-1.5">
        {live.map(row)}
      </ul>
      {archived.length > 0 && (
        <div className="flex flex-col">
          <button type="button" aria-expanded={archivedOpen} onClick={() => setArchivedOpen((v) => !v)} className="flex min-h-10 items-center gap-2 self-start rounded-xl px-1.5 text-[13px] font-bold text-ink-soft">
            <span className={`transition-transform duration-300 ${archivedOpen ? "rotate-90" : ""}`}>›</span>
            {fill(w.archived, { n: archived.length })}
          </button>
          <Collapse open={archivedOpen}>
            <ul className="flex flex-col rounded-[20px] bg-surface/70 p-1.5 opacity-80">{archived.map(row)}</ul>
          </Collapse>
        </div>
      )}
    </>
  );
}

/** One task of the content ID: date tile, type, people, late badge, status. Opens its day. */
function TaskRow({ task, index, me, today, t, onGo }: { task: TaskView; index: number; me: boolean; today: string; t: T; onGo: () => void }) {
  const w = t.contentWindow;
  const late = lateDays(task, today);
  const type = task.typeDeleted ? fill(t.deletedType, { name: task.typeName }) : task.typeName;
  const status = task.archived ? t.contents.archivedTask : task.statusDeleted ? fill(t.deletedStatus, { name: task.statusName }) : task.statusName;
  const people = task.assignees.length ? task.assignees.map((p) => p.name).join(", ") : w.noOne;
  const month = t.monthsShort[Number(task.dueDate.slice(5, 7)) - 1];
  return (
    <li className="zk-fade-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: "backwards" }}>
      <button
        type="button"
        data-task={task.id}
        onClick={onGo}
        aria-label={fill(w.goTo, { type, date: shortDate(task.dueDate, t) })}
        aria-current={me ? "true" : undefined}
        className={`flex w-full items-center gap-3 rounded-[14px] p-2.5 text-left transition-colors ${me ? "bg-teal-tint shadow-[inset_0_0_0_2px_var(--color-teal)]" : "hover:bg-mint-soft"}`}
      >
        <span className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[14px] leading-none ${me ? "bg-surface" : "bg-mint"}`}>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{t.weekdaysShort[weekdayIndex(task.dueDate)]}</span>
          <b className="text-[19px] font-bold leading-none">{Number(task.dueDate.slice(8))}</b>
          <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-teal-deep">{month}</span>
        </span>
        <span className={`hidden size-[30px] shrink-0 items-center justify-center rounded-[9px] text-teal-deep sm:flex ${me ? "bg-surface" : "bg-mint-soft"}`}>
          <TaskTypeIcon name={task.typeIcon} size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-1.5 text-[14.5px] font-semibold">
            {type}
            {me && <span className="rounded-full bg-teal px-2 py-px text-[11px] font-extrabold text-white">{w.thisTask}</span>}
          </span>
          <span className="truncate text-[12.5px] text-muted">
            {people}
            {task.deadline ? ` · ${fill(w.deadline, { date: shortDate(task.deadline, t) })}` : ""}
          </span>
        </span>
        {late > 0 && <span className="hidden whitespace-nowrap rounded-full bg-danger/10 px-2 py-[3px] text-[11px] font-extrabold text-danger sm:inline">{late === 1 ? t.dayOverdue : fill(t.daysOverdue, { n: late })}</span>}
        {!task.assignees.length && !task.archived && <span className="hidden whitespace-nowrap rounded-full bg-mint px-2 py-[3px] text-[11px] font-extrabold text-ink-soft sm:inline">{t.draft}</span>}
        <span className="hidden -space-x-2 md:flex">
          {task.assignees.slice(0, 3).map((p) => (
            <span key={p.id} aria-hidden="true" className="flex size-[26px] items-center justify-center rounded-full border-2 border-surface text-[9.5px] font-extrabold text-white" style={{ background: personColor(p.id) }}>
              {initials(p.name)}
            </span>
          ))}
        </span>
        <span className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[12.5px] font-bold ${me ? "bg-surface" : "bg-mint-soft"}`}>
          <span className="size-2 rounded-full" style={{ background: task.archived || task.statusDeleted ? "var(--color-subtle)" : task.statusColor }} />
          {status}
        </span>
        <span aria-hidden="true" className="hidden text-muted sm:inline">
          ›
        </span>
      </button>
    </li>
  );
}

/** A line from the first task to the last: one dot per task in its status colour, and "Today". */
function Timeline({ tasks, today, code, t }: { tasks: TaskView[]; today: string; code: string; t: T }) {
  const w = t.contentWindow;
  const start = tasks.reduce((m, x) => (x.dueDate < m ? x.dueDate : m), tasks[0].dueDate);
  const end = tasks.reduce((m, x) => (taskEnd(x) > m ? taskEnd(x) : m), taskEnd(tasks[0]));
  const span = Math.max(1, daysBetween(start, end));
  const at = (iso: string) => (start === end ? 50 : Math.min(100, Math.max(0, (daysBetween(start, iso) / span) * 100)));
  const todayAt = today < start ? 0 : today > end ? 100 : at(today);
  const showToday = today >= start && today <= end;
  return (
    <section aria-label={fill(w.timeline, { code })} className="hidden rounded-[20px] bg-surface px-4 pb-3 pt-4 sm:block">
      <div className="relative mx-2 h-[34px]">
        <span className="absolute inset-x-0 top-4 h-[3px] rounded-full bg-line-strong" />
        <span className="zk-grow-x absolute left-0 top-4 h-[3px] origin-left rounded-full bg-teal" style={{ width: `${todayAt}%` }} />
        {showToday && (
          <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-sun" style={{ left: `${todayAt}%` }}>
            <b className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] text-sun-ink">{w.today}</b>
          </span>
        )}
        {tasks.map((x, i) => (
          <span
            key={x.id}
            title={`${x.typeName} · ${shortDate(x.dueDate, t)}`}
            className="zk-pop absolute top-[9px] size-[17px] -translate-x-1/2 rounded-full border-[3px] border-surface shadow-[0_0_0_1px_var(--color-line-strong)]"
            style={{ left: `${at(x.dueDate)}%`, background: x.statusDeleted ? "var(--color-subtle)" : x.statusColor, animationDelay: `${120 + i * 50}ms`, animationFillMode: "backwards" }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold text-muted">
        <span>
          {t.weekdaysShort[weekdayIndex(start)]} {shortDate(start, t)}
        </span>
        {end !== start && (
          <span>
            {t.weekdaysShort[weekdayIndex(end)]} {shortDate(end, t)}
          </span>
        )}
      </div>
    </section>
  );
}
