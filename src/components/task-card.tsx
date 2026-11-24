"use client";

import Link from "next/link";
import { useCallback, useEffect, useOptimistic, useState, useTransition } from "react";
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
import { Collapse } from "./motion";
import { AvatarGroup, personColor } from "./avatar-group";
import { AddBriefButton, BriefTag, BriefWindow } from "./content-brief";
import { ContentNoteStrip } from "./content-note";
import { ContentWindow } from "./content-window";
import { DeadlineStrip } from "./deadline-strip";
import { AddFinishedButton, FinishedAsk, FinishedTag, FinishedWindow } from "./finished-work";
import { askForFinished } from "./held-day";
import { TaskTypeIcon } from "./task-type-icon";
import { initials } from "./top-bar";

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
  const [askAppear] = useState(asking);
  // Answered (Save or Not now): the question folds away first, then the card goes on to its new group.
  const stopAsking = useCallback(() => {
    setAsking(false);
    setTimeout(() => askForFinished.stop(task.id), 420);
  }, [task.id]);
  // Notes: loaded the first time they are opened (before opening, so nothing jumps), then kept and
  // refreshed whenever the task's note count changes, e.g. after someone else adds one.
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState<ShownNote[] | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(notesInitiallyOpen);
  const [seenCount, setSeenCount] = useState(task.notesCount);
  if (seenCount !== task.notesCount) {
    setSeenCount(task.notesCount);
    if (!notesOpen) setNotes(null); // closed: load fresh next time it opens
  }
  const fetchNotes = async () => {
    const result = await loadTaskNotes(task.id);
    if (!result.ok) {
      onError?.(result.error);
      return false;
    }
    setNotes((shown) => mergeNotes(shown, result.notes));
    return true;
  };
  const toggleNotes = async () => {
    if (notesOpen) return setNotesOpen(false);
    if (notes) {
      setNotesOpen(true);
      fetchNotes();
      return;
    }
    setLoadingNotes(true);
    const loaded = await fetchNotes();
    setLoadingNotes(false);
    if (loaded) setNotesOpen(true);
  };
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
  // Opened from a note notification: show the notes straight away.
  useEffect(() => {
    if (!notesInitiallyOpen) return;
    let alive = true;
    loadTaskNotes(task.id).then((result) => {
      if (!alive) return;
      setLoadingNotes(false);
      if (!result.ok) return onError?.(result.error);
      setNotes(mergeNotes(null, result.notes));
      setNotesOpen(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const notesCount = notes ? notes.filter((x) => !x.leaving).length : task.notesCount;
  const [, startTransition] = useTransition();
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
  const statusLabel = status.deleted ? fill(t.deletedStatus, { name: status.name }) : status.name;
  const typeLabel = task.typeDeleted ? fill(t.deletedType, { name: task.typeName }) : task.typeName;
  const addBrief = !task.hasBrief && canWriteBrief;
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
      className={`zk-card relative flex flex-col gap-2.5 rounded-[22px] border-[1.5px] p-3.5 transition-[background-color] duration-500 sm:gap-3 sm:px-5 sm:py-[18px] ${task.contentArchived ? "border-dashed border-subtle" : "border-transparent"} ${open ? "z-20" : "z-0"}`}
      style={{ "--card": background, "--tint": task.contentArchived || closed ? "var(--color-subtle)" : status.deleted ? "var(--color-subtle)" : status.color } as React.CSSProperties}
    >
      <div className="flex flex-col gap-2 border-b border-ink/12 pb-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        {contentWindow ? (
          <button
            type="button"
            onClick={() => setContentOpen(true)}
            aria-label={fill(t.contentWindow.open, { code: task.contentCode })}
            title={t.contentWindow.hint}
            className="flex items-center gap-1 rounded-lg bg-surface py-1 pl-2 pr-1.5 font-mono text-xs font-medium transition-shadow hover:shadow-[0_0_0_2px_var(--color-teal)] focus-visible:shadow-[0_0_0_2px_var(--color-teal)]"
          >
            {task.contentCode}
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-teal-deep">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </button>
        ) : (
          <span className="rounded-lg bg-surface px-2 py-1 font-mono text-xs font-medium">{task.contentCode}</span>
        )}
        {task.hasBrief && <BriefTag label={t.brief.tag} onOpen={() => setBriefOpen(true)} />}
        {task.hasFinishedWork && <FinishedTag f={t.finished} onOpen={() => setFinishedOpen(true)} />}
        {showCustomer && (
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="size-2.5 rounded-full border-[1.5px] border-black/25" style={{ background: task.customerColor }} />
            {task.customerName}
          </span>
        )}
        {task.contentArchived && <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft">{t.archivedContent}</span>}
        {lateDays > 0 && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-danger">{lateDays === 1 ? t.dayOverdue : fill(t.daysOverdue, { n: lateDays })}</span>
        )}
        {!task.assignees.length && <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft">{t.draft}</span>}
        <div className="relative ml-auto">
          <button
            type="button"
            disabled={!canChange}
            aria-haspopup="true"
            aria-expanded={open}
            aria-label={fill(t.statusAria, { name: statusLabel })}
            title={locked ? t.statusLocked : undefined}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface pl-2.5 pr-2 text-xs font-semibold disabled:cursor-default sm:min-h-11 sm:gap-2 sm:pl-3.5 sm:pr-3 sm:text-[13px]"
          >
            <span className="size-[9px] rounded-full transition-colors duration-500" style={{ background: status.deleted ? "var(--color-subtle)" : status.color }} />
            <span>{statusLabel}</span>
            {canChange && <Icon d="m6 9 6 6 6-6" />}
          </button>
          {open && (
            <>
              <button data-no-press type="button" aria-label={t.form.close} tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-[38px] z-20 flex min-w-[190px] flex-col gap-0.5 rounded-[18px] bg-surface p-1.5 shadow-[0_12px_32px_rgba(24,35,47,0.18)] sm:top-[50px] sm:min-w-[210px]">
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
      {task.contentNote && <ContentNoteStrip note={task.contentNote} label={fill(t.contents.noteOf, { code: task.contentCode })} more={t.contents.more} less={t.contents.less} />}
      </div>
      <h3 className="flex items-center gap-2.5 text-[17px] font-semibold sm:text-xl">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface/75 text-teal-deep sm:size-9">
          <TaskTypeIcon name={task.typeIcon} size={18} />
        </span>
        <span className="min-w-0">{typeLabel}</span>
      </h3>
      {task.description && <p className="max-w-[70ch] whitespace-pre-line text-sm leading-normal text-ink-body">{task.description}</p>}
      {task.deadline && (
        // A status just picked as finished has no finish day from the server yet: that is today.
        <DeadlineStrip start={task.dueDate} end={task.deadline} today={today} finished={status.finished} cancelled={status.cancelled} postponed={status.postponed} finishedOn={task.finished ? task.finishedOn : status.finished ? today : null} t={t} />
      )}
      <Collapse open={asking && !task.hasFinishedWork} appear={askAppear}>
        <FinishedAsk contentId={task.contentId} code={task.contentCode} taskId={task.id} t={t} onClose={stopAsking} onError={onError} />
      </Collapse>
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 border-t border-ink/12 pt-2 text-[13px] text-ink-soft">
        {(showAssignee || task.assignees.length > 1) && (
          <span className="flex min-w-0 items-center gap-2">
            {task.assignees.length ? (
              <>
                <AvatarGroup people={task.assignees} label={fill(t.peopleOn, { names: task.assignees.map((p) => p.name).join(", ") })} more={(n) => (n ? fill(t.peopleMore, { n }) : "")} />
                <span className="min-w-0 truncate font-medium text-ink">
                  {task.assignees.length === 1 ? task.assignees[0].name : fill(t.peopleFirstMore, { name: task.assignees[0].name, n: task.assignees.length - 1 })}
                </span>
              </>
            ) : (
              <span className="font-medium">{t.noAssignee}</span>
            )}
          </span>
        )}
        {!task.deadline && (
          <span className="flex items-center gap-1.5">
            <Icon d={CAL} />
            {fill(closed ? t.wasDue : t.due, { date: shortDate(end, t) })}
          </span>
        )}
        {task.note && (
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon d={NOTE} />
            {task.note}
          </span>
        )}
        {addBrief && (
          <span className="ml-auto">
            <AddBriefButton label={t.brief.add} onOpen={() => setBriefOpen(true)} />
          </span>
        )}
        {addFinished && (
          <span className={addBrief ? "" : "ml-auto"}>
            <AddFinishedButton label={t.finished.add} onOpen={() => setFinishedOpen(true)} />
          </span>
        )}
        <button
          type="button"
          aria-expanded={notesOpen}
          aria-busy={loadingNotes}
          onClick={toggleNotes}
          className={`flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition-colors sm:min-h-10 ${notesOpen ? "bg-surface text-ink" : "text-ink hover:bg-surface/60"} ${addBrief || addFinished ? "" : "ml-auto"}`}
        >
          {loadingNotes ? (
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden="true" />
          ) : (
            <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5" />
          )}
          {t.notes.button}
          {notesCount > 0 && <span key={notesCount} className="zk-pop flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-[11px] font-bold tabular-nums">{notesCount}</span>}
        </button>
        {editHref ? (
          <Link href={editHref} className="flex min-h-9 items-center gap-1.5 rounded-full py-0 pl-3 pr-1.5 text-[13px] font-semibold text-ink sm:min-h-11">
            {editButton}
          </Link>
        ) : onEdit ? (
          <button type="button" onClick={onEdit} className="flex min-h-9 items-center gap-1.5 rounded-full pl-3 pr-1.5 text-[13px] font-semibold text-ink sm:min-h-11">
            {editButton}
          </button>
        ) : null}
      </div>
      <Collapse open={notesOpen && !!notes} className="-mt-1 sm:-mt-1.5">
        {notes && (
          <div className="pt-1">
            <NotesPanel notes={notes} setNotes={setNotes} taskId={task.id} t={t} onError={onError} />
          </div>
        )}
      </Collapse>
      {contentOpen && <ContentWindow contentId={task.contentId} fromTask={task.id} onClose={closeContent} t={t} />}
      {finishedOpen && <FinishedWindow contentId={task.contentId} taskId={task.id} onClose={closeFinished} t={t} />}
      {briefOpen && <BriefWindow contentId={task.contentId} startEditing={!task.hasBrief} onClose={closeBrief} t={t} />}
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
