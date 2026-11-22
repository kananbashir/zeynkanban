"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setTaskStatus } from "@/app/actions/tasks";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { daysBetween } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { ARCHIVED_BACKGROUND, cardBackground } from "@/lib/task-rules";
import type { TaskView } from "@/lib/tasks";
import { initials } from "./top-bar";

export type StatusOption = { id: string; name: string; color: string; isFinished: boolean };

const AVATARS = ["#0b7f7b", "#5b4bc4", "#b4532a", "#1f6fb2", "#8a4b9c", "#4e6b1f"];
export function avatarColor(id: string) {
  let sum = 0;
  for (const ch of id) sum = (sum + ch.charCodeAt(0)) % 997;
  return AVATARS[sum % AVATARS.length];
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}
const CAL = "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18";
const NOTE = "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";

/** A full-width task card: content ID, customer, status (changeable from the card), type, description, assignee, date, note. */
export function TaskCard({
  task,
  statuses,
  canChangeStatus,
  today,
  t,
  showCustomer = true,
  showAssignee = true,
  editHref,
  onEdit,
  onError,
}: {
  task: TaskView;
  statuses: StatusOption[];
  canChangeStatus: boolean;
  today: string;
  t: Dictionary["tasks"];
  showCustomer?: boolean;
  showAssignee?: boolean;
  editHref?: string;
  onEdit?: () => void;
  onError?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  // The new status shows at once; the card moves to its new group when the page refreshes.
  const [statusId, setStatusId] = useOptimistic(task.statusId);
  const chosen = statusId !== task.statusId ? statuses.find((s) => s.id === statusId) : undefined;
  const status = chosen
    ? { name: chosen.name, color: chosen.color, finished: chosen.isFinished, deleted: false }
    : { name: task.statusName, color: task.statusColor, finished: task.finished, deleted: task.statusDeleted };
  const lateDays = !status.finished && task.dueDate < today ? daysBetween(task.dueDate, today) : 0;
  const statusLabel = status.deleted ? fill(t.deletedStatus, { name: status.name }) : status.name;
  const typeLabel = task.typeDeleted ? fill(t.deletedType, { name: task.typeName }) : task.typeName;
  const background = task.contentArchived ? ARCHIVED_BACKGROUND : cardBackground(status.color, status.finished);

  function choose(next: string) {
    setOpen(false);
    if (next === task.statusId) return;
    startTransition(async () => {
      setStatusId(next);
      const result = await setTaskStatus(task.id, next);
      if (!result.ok) onError?.(result.error);
    });
  }

  const editButton = (
    <>
      <Icon d={editHref ? "M7 17 17 7M7 7h10v10" : "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"} />
      {editHref ? t.openTask : t.edit}
    </>
  );

  return (
    <article
      data-task={task.id}
      data-flip={task.id}
      className={`relative flex flex-col gap-2.5 rounded-[22px] border-[1.5px] p-3.5 transition-[background-color] duration-500 sm:gap-3 sm:px-5 sm:py-[18px] ${task.contentArchived ? "border-dashed border-[#6b7785]" : "border-transparent"} ${open ? "z-20" : "z-0"}`}
      style={{ background }}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-ink/12 pb-3">
        <span className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-medium">{task.contentCode}</span>
        {showCustomer && (
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="size-2.5 rounded-full border-[1.5px] border-black/25" style={{ background: task.customerColor }} />
            {task.customerName}
          </span>
        )}
        {task.contentArchived && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft">{t.archivedContent}</span>}
        {lateDays > 0 && (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-danger">{lateDays === 1 ? t.dayOverdue : fill(t.daysOverdue, { n: lateDays })}</span>
        )}
        {!task.assigneeId && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-soft">{t.draft}</span>}
        <div className="relative ml-auto">
          <button
            type="button"
            disabled={!canChangeStatus}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label={fill(t.statusAria, { name: statusLabel })}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-white pl-2.5 pr-2 text-xs font-semibold disabled:cursor-default sm:min-h-11 sm:gap-2 sm:pl-3.5 sm:pr-3 sm:text-[13px]"
          >
            <span className="size-[9px] rounded-full transition-colors duration-500" style={{ background: status.deleted ? "#6b7785" : status.color }} />
            <span>{statusLabel}</span>
            {canChangeStatus && <Icon d="m6 9 6 6 6-6" />}
          </button>
          {open && (
            <>
              <button type="button" aria-label={t.form.close} tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-[38px] z-20 flex min-w-[190px] flex-col gap-0.5 rounded-[18px] bg-white p-1.5 shadow-[0_12px_32px_rgba(24,35,47,0.18)] sm:top-[50px] sm:min-w-[210px]">
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => choose(s.id)}
                    className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-medium sm:min-h-11 sm:px-3 sm:text-sm ${s.id === statusId ? "bg-mint" : "hover:bg-mint-soft"}`}
                  >
                    <span className="size-[9px] shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1">{s.name}</span>
                    {s.id === statusId && <Icon d="m5 12 5 5L20 7" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <h3 className="text-[17px] font-semibold sm:text-xl">{typeLabel}</h3>
      {task.description && <p className="max-w-[70ch] whitespace-pre-line text-sm leading-normal text-[#2b3644]">{task.description}</p>}
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 border-t border-ink/12 pt-2 text-[13px] text-ink-soft">
        {showAssignee && <span className="flex items-center gap-2">
          {task.assigneeId ? (
            <>
              <span className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatarColor(task.assigneeId) }}>
                {initials(task.assigneeName ?? "?")}
              </span>
              <span className="font-medium text-ink">{task.assigneeName}</span>
            </>
          ) : (
            <span className="font-medium">{t.noAssignee}</span>
          )}
        </span>}
        <span className="flex items-center gap-1.5">
          <Icon d={CAL} />
          {fill(status.finished ? t.wasDue : t.due, { date: shortDate(task.dueDate, t) })}
        </span>
        {task.note && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon d={NOTE} />
            {task.note}
          </span>
        )}
        {editHref ? (
          <Link href={editHref} className="ml-auto flex min-h-9 items-center gap-1.5 rounded-full py-0 pl-3 pr-1.5 text-[13px] font-semibold text-ink sm:min-h-11">
            {editButton}
          </Link>
        ) : onEdit ? (
          <button type="button" onClick={onEdit} className="ml-auto flex min-h-9 items-center gap-1.5 rounded-full pl-3 pr-1.5 text-[13px] font-semibold text-ink sm:min-h-11">
            {editButton}
          </button>
        ) : null}
      </div>
    </article>
  );
}
