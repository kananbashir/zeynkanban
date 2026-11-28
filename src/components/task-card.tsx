"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { addTaskNote, deleteTaskNote, loadTaskNotes, type TaskNote } from "@/app/actions/task-notes";
import { setTaskStatus } from "@/app/actions/tasks";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { daysBetween } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { MAX_NOTES, NOTE_LENGTH } from "@/lib/note-rules";
import { ARCHIVED_BACKGROUND, cardBackground, taskEnd } from "@/lib/task-rules";
import type { TaskView } from "@/lib/tasks";
import { useMe } from "./me";
import { Collapse, useIsWide } from "./motion";
import { AvatarGroup, personColor } from "./avatar-group";
import { BriefWindow } from "./content-brief";
import { PinIcon } from "./content-note";
import { CloseButton, ConfirmDialog } from "./dialog";
import { Sheet, useSheetClose } from "./sheet";
import { ActionButtons, cardButtonClass, ClampText, useIsNarrow, useStackWhenTight } from "./task-card-parts";
import { ContentWindow } from "./content-window";
import { DeadlineStrip } from "./deadline-strip";
import { NudgeButton } from "./nudge-button";
import { FinishedAsk, FinishedWindow } from "./finished-work";
import { askForFinished } from "./held-day";
import { TaskTypeIcon } from "./task-type-icon";
import { initials } from "./top-bar";
import { writesBriefs } from "@/lib/roles";

export type StatusOption = { id: string; name: string; color: string; isFinished: boolean; isCancelled?: boolean; isPostponed?: boolean };

/** The colour of a person's avatar (the same everywhere). */
export const avatarColor = personColor;

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}
const CAL = "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18";
const ALERT = "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8v5M12 16.5v.01";
/** The task's own note: a sheet of paper with lines. */
const NOTE_SHEET = "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8zM15 3v4a2 2 0 0 0 2 2h4M7 13h6M7 17h4";
const BRIEF = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5";
const BANK = "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z";
const CLOCK = "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2";
const DONE = "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3";
const NOTE = "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z";

/** A full-width task card: content ID, customer, status (changeable from the card), type, description, the people on it, date, note. */
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
  onChanged,
  notesInitiallyOpen = false,
  briefInitiallyOpen = false,
  finishedInitiallyOpen = false,
  contentWindow = false,
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
  /** Called after the status was saved, before the new status stops being "optimistic". */
  onChanged?: () => Promise<void> | void;
  notesInitiallyOpen?: boolean;
  /** Opened from a brief notification: show the content brief straight away. */
  briefInitiallyOpen?: boolean;
  /** Opened from a finished-work notification: show the finished work straight away. */
  finishedInitiallyOpen?: boolean;
  /** The content ID opens a window with all tasks of it (on the board and the customer page). */
  contentWindow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The bell's small window is open (the card is lifted above the next ones, as for the status menu).
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const me = useMe();
  // The content brief window. Admins and managers (who can edit tasks) can also write one.
  const [briefOpen, setBriefOpen] = useState(briefInitiallyOpen);
  const closeBrief = useCallback(() => setBriefOpen(false), []);
  const canWriteBrief = !!(onEdit || editHref);
  // The finished work of the content ID: its window, and the question asked right after "Done".
  const [finishedOpen, setFinishedOpen] = useState(finishedInitiallyOpen);
  const closeFinished = useCallback(() => setFinishedOpen(false), []);
  const [contentOpen, setContentOpen] = useState(false);
  const closeContent = useCallback(() => setContentOpen(false), []);
  // A card that just moved to its "finished" group is a new card: it picks the question up again.
  const [asking, setAsking] = useState(() => askForFinished.has(task.id) && !task.hasFinishedWork);
  // Answered (Save or Not now): the question folds away first, then the card goes on to its new group.
  const stopAsking = useCallback(() => {
    setAsking(false);
    setTimeout(() => askForFinished.stop(task.id), 420);
  }, [task.id]);
  // Notes: loaded the first time they are opened (before opening, so nothing jumps), then kept and
  // refreshed whenever the task's note count changes, e.g. after someone else adds one.
  const [notesOpen, setNotesOpen] = useState(notesInitiallyOpen);
  const [notes, setNotes] = useState<ShownNote[] | null>(null);
  const [seenCount, setSeenCount] = useState(task.notesCount);
  if (seenCount !== task.notesCount) {
    setSeenCount(task.notesCount);
    if (!notesOpen) setNotes(null); // closed: load fresh next time it opens
  }
  const fetchNotes = async () => {
    const result = await loadTaskNotes(task.id);
    if (!result.ok) return onError?.(result.error);
    setNotes((shown) => mergeNotes(shown, result.notes));
  };
  // The notes open in a window over the page (loading there the first time).
  const openNotes = () => {
    setNotesOpen(true);
    fetchNotes();
  };
  const closeNotes = useCallback(() => setNotesOpen(false), []);
  // Open: someone else added or deleted a note, so show the current list.
  useEffect(() => {
    if (!notesOpen) return;
    let alive = true;
    loadTaskNotes(task.id).then((result) => {
      if (alive && result.ok) setNotes((shown) => mergeNotes(shown, result.notes));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.notesCount]);
  // Opened from a note notification: the notes window is open from the start; load them.
  useEffect(() => {
    if (!notesInitiallyOpen) return;
    let alive = true;
    loadTaskNotes(task.id).then((result) => {
      if (!alive) return;
      if (!result.ok) return onError?.(result.error);
      setNotes(mergeNotes(null, result.notes));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const notesCount = notes ? notes.filter((x) => !x.leaving).length : task.notesCount;
  const [, startTransition] = useTransition();
  const router = useRouter();
  const narrow = useIsNarrow();
  const wide = useIsWide();
  // The new status shows at once; the card moves to its new group when the page refreshes.
  const [statusId, setStatusId] = useOptimistic(task.statusId);
  const chosen = statusId !== task.statusId ? statuses.find((s) => s.id === statusId) : undefined;
  const status = chosen
    ? { name: chosen.name, color: chosen.color, finished: chosen.isFinished && !chosen.isCancelled, cancelled: !!chosen.isCancelled, postponed: !!chosen.isPostponed && !chosen.isFinished && !chosen.isCancelled, deleted: false }
    : { name: task.statusName, color: task.statusColor, finished: task.finished, cancelled: task.cancelled, postponed: task.postponed, deleted: task.statusDeleted };
  const closed = status.finished || status.cancelled;
  // Only admins and managers (who can edit tasks) may cancel or postpone.
  const choices = canWriteBrief ? statuses : statuses.filter((s) => !s.isCancelled && !s.isPostponed);
  // A cancelled or postponed task is locked for employees: only admins and managers can move it on.
  const locked = !canWriteBrief && (task.cancelled || task.postponed);
  const canChange = canChangeStatus && !locked;
  const end = taskEnd(task); // the deadline, or the task's day without one
  const lateDays = !closed && !status.postponed && end < today ? daysBetween(end, today) : 0;
  const lateLabel = lateDays === 1 ? t.dayOverdue : fill(t.daysOverdue, { n: lateDays });
  const statusLabel = status.deleted ? fill(t.deletedStatus, { name: status.name }) : status.name;
  const typeLabel = task.typeDeleted ? fill(t.deletedType, { name: task.typeName }) : task.typeName;
  // Anyone who sees the card (on the task, or an admin or manager) may add a brief when there is none; graphic designers only read them.
  const addBrief = !task.hasBrief && writesBriefs(me?.role ?? "");
  // Not while the question is open or folding away: the button shows once the card has moved on.
  const addFinished = status.finished && !task.hasFinishedWork && !asking && !askForFinished.has(task.id);
  const background = task.contentArchived ? ARCHIVED_BACKGROUND : cardBackground(status.color, closed);

  function choose(next: string) {
    setOpen(false);
    if (next === task.statusId) return;
    const picked = statuses.find((s) => s.id === next);
    const ask = !!picked?.isFinished && !picked.isCancelled && !task.hasFinishedWork;
    if (ask && picked) askForFinished.start(task.id, { statusId: picked.id, statusName: picked.name, statusColor: picked.color, finished: true, cancelled: false, postponed: false, finishedOn: today });
    else askForFinished.stop(task.id);
    setAsking(ask);
    startTransition(async () => {
      setStatusId(next);
      const result = await setTaskStatus(task.id, next);
      if (!result.ok) {
        setAsking(false);
        askForFinished.stop(task.id);
        onError?.(result.error);
      } else await onChanged?.();
    });
  }

  // Clicking the card asks admins and managers whether to open the task (the edit window on the customer
  // page); for others it does nothing. Buttons, links and the windows opened from the card keep their own clicks.
  const openTask = editHref ? () => router.push(editHref) : onEdit;
  const [askOpen, setAskOpen] = useState(false);
  const stopAskOpen = () => setAskOpen(false);
  const onCardClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!openTask) return;
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target) || target.closest("button, a, input, textarea, select, label, [data-avatar]")) return;
    if (window.getSelection()?.toString()) return; // selecting text, not clicking
    setAskOpen(true);
  };
  // Without a deadline after its day, the task is due on its day: lateness shows as a bar on top.
  const hasSpan = !!task.deadline && task.deadline !== task.dueDate;
  const showPeople = showAssignee || task.assignees.length > 1;
  const panel = "zk-panel rounded-[16px] max-sm:rounded-[13px]";
  const box = `${panel} px-4 py-3.5 max-sm:px-[9px] max-sm:py-2`;
  // Notes and the people: side by side, or stacked when the people would not fit beside Notes.
  const peopleRow = useRef<HTMLDivElement>(null);
  const stackPeople = useStackWhenTight(peopleRow);
  const fit = "inline-flex items-center gap-1.5 whitespace-nowrap max-sm:gap-1";
  const smallChip = "flex h-[30px] items-center rounded-[10px] bg-surface px-2.5 text-xs font-semibold leading-none text-ink-soft max-sm:h-[17px] max-sm:rounded-[5px] max-sm:px-1 max-sm:text-[8.5px]";

  return (
    <article
      data-task={task.id}
      data-flip={task.id}
      onClick={onCardClick}
      className={`zk-card relative flex flex-col gap-2.5 rounded-[26px] p-2.5 transition-[background-color] duration-500 max-sm:gap-[5px] max-sm:rounded-[18px] max-sm:p-[5px] ${openTask ? "cursor-pointer" : ""} ${task.contentArchived ? "outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-subtle" : ""} ${open || nudgeOpen ? "z-20" : "z-0"}`}
      style={{ "--card": background, "--tint": task.contentArchived || closed ? "var(--color-subtle)" : status.deleted ? "var(--color-subtle)" : status.color } as React.CSSProperties}
    >
      {!hasSpan && lateDays > 0 && (
        <div className="flex h-[42px] items-center gap-2 rounded-[16px] bg-[color-mix(in_oklab,var(--color-danger)_22%,var(--card-bg))] px-4 text-[13.5px] font-bold leading-none text-danger max-sm:h-6 max-sm:gap-1 max-sm:rounded-[13px] max-sm:px-[9px] max-sm:text-[9.5px]">
          <Icon d={ALERT} size={narrow ? 11 : 16} />
          {lateLabel}
        </div>
      )}

      {/* Four panels: content ID | customer, bell and status; task type | notes and the people on it. */}
      <div className="grid grid-cols-2 gap-2.5 max-sm:gap-[5px]">
        <div className={`${box} flex min-w-0 flex-col justify-center`}>
          <div className="flex flex-wrap items-center gap-1.5 max-sm:gap-1">
            {contentWindow ? (
              <button
                type="button"
                onClick={() => setContentOpen(true)}
                aria-label={fill(t.contentWindow.open, { code: task.contentCode })}
                title={t.contentWindow.hint}
                className="flex h-[30px] items-center gap-1.5 rounded-[10px] bg-surface px-2.5 font-mono text-[13px] font-semibold leading-none transition-shadow hover:shadow-[0_0_0_2px_var(--color-teal)] focus-visible:shadow-[0_0_0_2px_var(--color-teal)] max-sm:h-[17px] max-sm:gap-0.5 max-sm:rounded-[5px] max-sm:px-1 max-sm:text-[8.5px]"
              >
                {task.contentCode}
                <svg viewBox="0 0 24 24" width={narrow ? 8 : 13} height={narrow ? 8 : 13} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-teal-deep">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </button>
            ) : (
              <span className="flex h-[30px] items-center rounded-[10px] bg-surface px-2.5 font-mono text-[13px] font-semibold leading-none max-sm:h-[17px] max-sm:rounded-[5px] max-sm:px-1 max-sm:text-[8.5px]">{task.contentCode}</span>
            )}
            {task.contentArchived && <span className={smallChip}>{t.archivedContent}</span>}
            {!task.assignees.length && <span className={smallChip}>{t.draft}</span>}
          </div>
        </div>
        {/* On a computer one row (customer left, bell and status right); on a phone stacked on the right. */}
        <div className={`${box} flex min-w-0 items-center gap-3 max-sm:flex-col max-sm:items-end max-sm:gap-[5px] ${showCustomer ? "justify-between" : "justify-end max-sm:justify-center"}`}>
          {showCustomer && (
            <span className="flex min-w-0 max-w-full flex-row-reverse items-center gap-2 text-[15px] font-semibold leading-tight max-sm:flex-row max-sm:gap-1 max-sm:text-[9px]">
              <span className="truncate">{task.customerName}</span>
              <span className="size-[11px] shrink-0 rounded-full border-[1.5px] border-black/25 max-sm:size-[7px] max-sm:border" style={{ background: task.customerColor }} />
            </span>
          )}
          <div className="relative flex min-w-0 max-w-full items-center gap-2 max-sm:gap-[3px]">
            {/* Admins and managers can remind the people on the task with the bell. */}
            {canWriteBrief && !task.archived && <NudgeButton task={task} meId={me?.id} t={t} onError={onError} onOpenChange={setNudgeOpen} />}
            <div className="relative min-w-0">
              <button
                type="button"
                disabled={!canChange}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={fill(t.statusAria, { name: statusLabel })}
                title={locked ? t.statusLocked : undefined}
                onClick={() => setOpen((v) => !v)}
                className="flex h-10 min-w-0 max-w-full items-center gap-2 rounded-full bg-surface pl-3.5 pr-3 text-[13.5px] font-semibold leading-none disabled:cursor-default max-sm:h-[22px] max-sm:gap-[3px] max-sm:pl-[7px] max-sm:pr-1.5 max-sm:text-[9.5px]"
              >
                <span className="size-[9px] shrink-0 rounded-full transition-colors duration-500 max-sm:size-[5px]" style={{ background: status.deleted ? "var(--color-subtle)" : status.color }} />
                <span className="truncate leading-tight">{statusLabel}</span>
                {canChange && <Icon d="m6 9 6 6 6-6" size={narrow ? 9 : 14} />}
              </button>
              {open && (
                <>
                  <button data-no-press type="button" aria-label={t.form.close} tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+6px)] z-20 flex min-w-[190px] flex-col gap-0.5 rounded-[18px] bg-surface p-1.5 shadow-[0_12px_32px_rgba(24,35,47,0.18)] sm:min-w-[210px]">
                    {choices.map((s) => (
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
        </div>

        <div className={`${box} flex min-w-0 flex-col justify-center`}>
          <h3 className="flex min-w-0 items-center gap-2.5 text-[19px] font-semibold leading-tight max-sm:gap-[5px] max-sm:text-[11.5px]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface text-teal-deep max-sm:size-5 max-sm:rounded-[6px]">
              <TaskTypeIcon name={task.typeIcon} size={narrow ? 11 : 18} />
            </span>
            {editHref ? (
              <Link href={editHref} aria-label={`${t.openTask}: ${typeLabel}`} className="min-w-0 break-words">
                {typeLabel}
              </Link>
            ) : onEdit ? (
              <button type="button" onClick={onEdit} aria-label={`${t.edit}: ${typeLabel}`} className="min-w-0 break-words text-left">
                {typeLabel}
              </button>
            ) : (
              <span className="min-w-0 break-words">{typeLabel}</span>
            )}
          </h3>
        </div>
        {/* Side by side when they fit; otherwise the people go under Notes, both on the right. */}
        <div ref={peopleRow} className={`${box} flex min-w-0 gap-x-3 gap-y-2 max-sm:gap-x-1.5 max-sm:gap-y-[5px] ${stackPeople ? "flex-col items-end justify-center" : "items-center justify-between"}`}>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={notesOpen}
            onClick={openNotes}
            className="flex h-9 items-center gap-1.5 rounded-full pl-2.5 pr-1 text-[13.5px] font-semibold leading-none text-ink transition-colors hover:bg-surface/60 max-sm:h-[18px] max-sm:gap-[3px] max-sm:pl-0 max-sm:pr-0 max-sm:text-[9.5px]"
          >
            <Icon d={NOTE} size={narrow ? 10 : 16} />
            {t.notes.button}
            {notesCount > 0 && (
              <span key={notesCount} className="zk-pop flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-surface px-1.5 text-[11px] font-bold leading-none tabular-nums max-sm:h-3.5 max-sm:min-w-3.5 max-sm:px-1 max-sm:text-[8px]">
                {notesCount}
              </span>
            )}
          </button>
          {showPeople && (
            <span className="flex min-w-0 max-w-full items-center gap-2 text-[13px] font-semibold leading-tight max-sm:gap-[3px] max-sm:text-[9.5px]">
              {task.assignees.length ? (
                <>
                  <span className="min-w-0 truncate">
                    {task.assignees.length === 1 ? task.assignees[0].name : fill(t.peopleFirstMore, { name: task.assignees[0].name, n: task.assignees.length - 1 })}
                  </span>
                  <AvatarGroup size={narrow ? 17 : 30} people={task.assignees} label={fill(t.peopleOn, { names: task.assignees.map((p) => p.name).join(", ") })} more={(n) => (n ? fill(t.peopleMore, { n }) : "")} />
                </>
              ) : (
                <span className="text-ink-soft">{t.noAssignee}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {task.contentNote && (
        <div role="note" aria-label={fill(t.contents.noteOf, { code: task.contentCode })} className={`${box} py-3 max-sm:py-2`}>
          <ClampText
            text={task.contentNote}
            more={t.contents.more}
            less={t.contents.less}
            icon={<PinIcon size={narrow ? 9 : 14} className="mr-[7px] mt-[3px] text-sun-ink max-sm:mr-[3px] max-sm:mt-0.5" />}
            className="text-[13px] leading-[1.45] text-ink-body max-sm:text-[9.5px] max-sm:leading-[1.4]"
          />
        </div>
      )}
      {(task.description || task.note) && (
        <div className={`${box} flex flex-col gap-2 max-sm:gap-[5px]`}>
          {task.description && <ClampText text={task.description} more={t.contents.more} less={t.contents.less} className="text-sm leading-normal text-ink-body max-sm:text-[10.5px] max-sm:leading-[1.45]" />}
          {task.note && (
            <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] leading-snug text-ink-soft max-sm:gap-[3px] max-sm:text-[9px]">
              <Icon d={NOTE_SHEET} size={narrow ? 9 : 14} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{task.note}</span>
            </span>
          )}
        </div>
      )}

      {/* Brief, finished work, and adding them. Hidden when there is none of these. */}
      <ActionButtons grid={!wide}>
        {task.hasBrief && (
          <button type="button" onClick={() => setBriefOpen(true)} aria-label={task.briefFromBank ? [t.brief.tag, t.brief.fromBank, task.briefBankPending ? t.brief.bankPending : ""].filter(Boolean).join(" · ") : undefined} className={cardButtonClass("dark")}>
            <span data-fit className={fit}>
              <Icon d={BRIEF} size={narrow ? 11 : 15} />
              {t.brief.tag}
              {task.briefFromBank && (
                <span title={t.brief.fromBank} className="flex size-[17px] items-center justify-center rounded-full bg-teal text-white max-sm:size-3">
                  <Icon d={BANK} size={narrow ? 8 : 11} />
                </span>
              )}
              {task.briefBankPending && (
                <span title={t.brief.bankPending} className="flex size-[17px] items-center justify-center rounded-full bg-sun text-on-pastel max-sm:size-3">
                  <Icon d={CLOCK} size={narrow ? 8 : 11} />
                </span>
              )}
            </span>
          </button>
        )}
        {task.hasFinishedWork && (
          <button type="button" onClick={() => setFinishedOpen(true)} aria-label={t.finished.tag} className={cardButtonClass("leaf")}>
            <span data-fit className={fit}>
              <Icon d={DONE} size={narrow ? 11 : 15} />
              {t.finished.tag}
            </span>
          </button>
        )}
        {addBrief && (
          <button type="button" onClick={() => setBriefOpen(true)} className={cardButtonClass("dashed")}>
            <span data-fit className={fit}>
              <span aria-hidden="true">+</span>
              {t.brief.add}
            </span>
          </button>
        )}
        {addFinished && (
          <button type="button" onClick={() => setFinishedOpen(true)} className={cardButtonClass("dashed")}>
            <span data-fit className={fit}>
              <span aria-hidden="true">+</span>
              {t.finished.add}
            </span>
          </button>
        )}
      </ActionButtons>

      {hasSpan ? (
        // A status just picked as finished has no finish day from the server yet: that is today.
        <DeadlineStrip start={task.dueDate} end={task.deadline!} today={today} finished={status.finished} cancelled={status.cancelled} postponed={status.postponed} finishedOn={task.finished ? task.finishedOn : status.finished ? today : null} t={t} />
      ) : (
        <div className={`${panel} flex h-12 items-center gap-2 px-4 text-[13.5px] leading-none text-ink-soft max-sm:h-[26px] max-sm:gap-1 max-sm:px-[9px] max-sm:text-[9.5px]`}>
          <Icon d={CAL} size={narrow ? 11 : 16} />
          {fill(closed ? t.wasDue : t.due, { date: shortDate(end, t) })}
        </div>
      )}

      {notesOpen && (
        <Sheet label={t.notes.title} onClose={closeNotes} width="sm:max-w-[560px]" header={<SheetHeading eyebrow={`${t.notes.title} · ${task.contentCode}`} title={typeLabel} close={t.form.close} />}>
          {notes ? <NotesPanel notes={notes} setNotes={setNotes} taskId={task.id} t={t} onError={onError} /> : <p className="py-6 text-center text-sm text-muted">{t.brief.loading}</p>}
        </Sheet>
      )}
      {asking && !task.hasFinishedWork && (
        <Sheet label={t.finished.askTitle} onClose={stopAsking} width="sm:max-w-[600px]" header={<SheetHeading title={t.finished.askTitle} text={fill(t.finished.askText, { code: task.contentCode })} close={t.form.close} icon={<Icon d={DONE} size={19} />} />}>
          <AskBody contentId={task.contentId} code={task.contentCode} taskId={task.id} t={t} onError={onError} />
        </Sheet>
      )}
      {contentOpen && <ContentWindow contentId={task.contentId} fromTask={task.id} onClose={closeContent} t={t} />}
      {finishedOpen && <FinishedWindow contentId={task.contentId} taskId={task.id} onClose={closeFinished} t={t} />}
      {briefOpen && <BriefWindow contentId={task.contentId} startEditing={!task.hasBrief} onClose={closeBrief} t={t} />}
      {askOpen &&
        openTask &&
        createPortal(
          <ConfirmDialog
            title={t.askOpen.title}
            text={`${task.contentCode} · ${typeLabel}`}
            confirmLabel={t.openTask}
            cancelLabel={t.askOpen.cancel}
            tone="dark"
            onCancel={stopAskOpen}
            onConfirm={() => {
              setAskOpen(false);
              openTask();
            }}
          />,
          document.body,
        )}
    </article>
  );
}

type ShownNote = TaskNote & { key: string; pending?: boolean; leaving?: boolean; appear?: boolean };

const bakuClock = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

/**
 * Brings the list in line with the server without disturbing what is on screen: notes already shown
 * keep their place, a note still being sent is matched to its saved copy, notes on their way out
 * finish folding away, and notes someone else just added slide in.
 */
function mergeNotes(shown: ShownNote[] | null, fresh: TaskNote[]): ShownNote[] {
  const used = new Set<string>();
  const out: ShownNote[] = fresh.map((n) => {
    const same = shown?.find((s) => s.id === n.id) ?? shown?.find((s) => s.pending && s.mine && n.mine && s.body === n.body && !used.has(s.key));
    if (same) used.add(same.key);
    return { ...n, key: same?.key ?? n.id, appear: !!shown && !same, leaving: same?.leaving };
  });
  shown?.forEach((s, i) => {
    if (!used.has(s.key) && (s.leaving || s.pending)) out.splice(Math.min(i, out.length), 0, s);
  });
  return out;
}

/** The notes of a task: read, add (up to 10 per task), delete your own. */
function NotesPanel({
  notes,
  setNotes,
  taskId,
  t,
  onError,
}: {
  notes: ShownNote[];
  setNotes: (update: (list: ShownNote[] | null) => ShownNote[] | null) => void;
  taskId: string;
  t: Dictionary["tasks"];
  onError?: (message: string) => void;
}) {
  const n = t.notes;
  const me = useMe();
  const [text, setText] = useState("");
  const visible = notes.filter((x) => !x.leaving);
  const full = visible.length >= MAX_NOTES;

  // Shown at once and confirmed by the server; on failure it folds away again.
  const add = async () => {
    const body = text.trim();
    if (!body || full) return;
    const key = `new-${Date.now()}`;
    setText("");
    setNotes((list) => [...(list ?? []), { id: key, key, author: me?.name ?? "", authorId: me?.id ?? "", body, when: bakuClock(), mine: true, canDelete: true, pending: true, appear: true }]);
    const result = await addTaskNote(taskId, body);
    if (!result.ok) {
      setNotes((list) => list?.map((x) => (x.key === key ? { ...x, leaving: true } : x)) ?? null);
      setTimeout(() => setNotes((list) => list?.filter((x) => x.key !== key) ?? null), 330);
      setText(body);
      return onError?.(result.error);
    }
    setNotes((list) => list?.filter((x) => x.key === key || x.id !== result.note.id).map((x) => (x.key === key ? { ...result.note, key } : x)) ?? null);
  };

  const remove = async (note: ShownNote) => {
    setNotes((list) => list?.map((x) => (x.key === note.key ? { ...x, leaving: true } : x)) ?? null);
    const [result] = await Promise.all([deleteTaskNote(note.id), new Promise((r) => setTimeout(r, 330))]);
    if (!result.ok) {
      setNotes((list) => list?.map((x) => (x.key === note.key ? { ...x, leaving: false } : x)) ?? null);
      return onError?.(result.error);
    }
    setNotes((list) => list?.filter((x) => x.key !== note.key) ?? null);
  };

  return (
    <section aria-label={n.title} className="flex flex-col rounded-[18px] bg-surface/80 p-3 sm:p-3.5">
      <Collapse open={visible.length === 0}>
        <p className="pb-2.5 text-[13px] text-muted">{n.empty}</p>
      </Collapse>
      <ul className="flex flex-col">
        {notes.map((note) => (
          <li key={note.key}>
            <Collapse open={!note.leaving} appear={note.appear}>
              <div className={`flex items-start gap-2.5 pb-2.5 transition-opacity duration-300 ${note.pending ? "opacity-60" : ""}`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: note.authorId ? avatarColor(note.authorId) : "var(--color-subtle)" }}>
                  {initials(note.author || "?")}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <span className="font-semibold">{note.mine ? n.you : note.author}</span>
                    <span className="text-xs text-muted">{note.when}</span>
                  </span>
                  <p className="whitespace-pre-line text-sm leading-snug text-ink-body [overflow-wrap:anywhere]">{note.body}</p>
                </div>
                {note.canDelete && !note.pending && (
                  <button type="button" aria-label={n.remove} title={n.remove} disabled={note.leaving} onClick={() => remove(note)} className="flex size-8 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
                    <Icon d="M6 6l12 12M18 6 6 18" size={14} />
                  </button>
                )}
              </div>
            </Collapse>
          </li>
        ))}
      </ul>
      <Collapse open={full}>
        <p className="rounded-xl bg-mint px-3 py-2 text-[13px] text-ink-soft">{n.full}</p>
      </Collapse>
      <Collapse open={!full}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <textarea
            aria-label={n.placeholder}
            placeholder={n.placeholder}
            value={text}
            maxLength={NOTE_LENGTH}
            rows={1}
            disabled={full}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            className="min-h-11 min-w-0 flex-[1_1_220px] resize-none rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3 py-2.5 text-sm"
          />
          <button type="submit" disabled={!text.trim() || full} className="min-h-11 rounded-full bg-teal px-4 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50">
            {n.add}
          </button>
          <span className="basis-full text-right text-[11px] text-muted tabular-nums">{fill(n.count, { n: visible.length })}</span>
        </form>
      </Collapse>
    </section>
  );
}

/** The top of a window opened from the card: a small line above, its title (or a line under it), and ✕. */
function SheetHeading({ eyebrow, title, text, icon, close }: { eyebrow?: string; title: string; text?: string; icon?: ReactNode; close: string }) {
  const done = useSheetClose();
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-leaf-tint text-leaf-ink">{icon}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {eyebrow && <span className="text-[13px] font-semibold text-teal-deep">{eyebrow}</span>}
        <h2 className="text-lg font-semibold leading-snug sm:text-xl">{title}</h2>
        {text && <span className="text-[12.5px] leading-snug text-muted">{text}</span>}
      </div>
      <CloseButton label={close} onClick={done} />
    </div>
  );
}

/** "Done! Add the finished work?" in its window: Save or Not now close the window (with its movement). */
function AskBody({ contentId, code, taskId, t, onError }: { contentId: string; code: string; taskId: string; t: Dictionary["tasks"]; onError?: (message: string) => void }) {
  const close = useSheetClose();
  return <FinishedAsk bare contentId={contentId} code={code} taskId={taskId} t={t} onClose={close} onError={onError} />;
}
