"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FinishedTag, FinishedWindow } from "@/components/finished-work";
import { InlineText } from "@/components/inline-text";
import { PinIcon } from "@/components/content-note";
import { Collapse, SegmentedControl } from "@/components/motion";
import { Toast, useToast } from "@/components/toast";
import { btn, card, field, row, rowOff } from "@/components/ui";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { setTaskArchived } from "@/app/actions/tasks";
import { CONTENT_NOTE_MAX, suggestContentId } from "@/lib/content-rules";
import { shortDate } from "@/lib/format-date";
import type { TaskView } from "@/lib/tasks";
import { addContent, renameContent, setContentArchived, setContentNote } from "../actions";

type Period = { id: string; label: string; code: string };
type Content = { id: string; code: string; archived: boolean; contentTypeId: string; typeName: string; typeCode: string; contractId: string | null; note: string | null; noteBy: string | null; noteAt: Date | null };
type ContentType = { id: string; code: string; name: string };

export function ContentsTab({
  customerId,
  shortName,
  periods,
  contents,
  types,
  tasks,
  publishDates,
  canArchive,
  taskT,
  t,
  errors,
}: {
  customerId: string;
  shortName: string;
  periods: Period[];
  contents: Content[];
  types: ContentType[];
  tasks: TaskView[];
  publishDates: Record<string, string>;
  canArchive: boolean;
  taskT: Dictionary["tasks"];
  t: Dictionary["customers"]["contents"];
  errors: Dictionary["errors"];
}) {
  const { message, show } = useToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [contractId, setContractId] = useState(periods[0]?.id ?? "");
  const [typed, setTyped] = useState<string | null>(null); // null = use the suggestion
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  // IDs saved from this form, counted for the next suggestion even before the page has refreshed.
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  // The content ID whose finished work is open in a window.
  const [finishedOf, setFinishedOf] = useState<string | null>(null);

  const periodById = useMemo(() => new Map(periods.map((p) => [p.id, p])), [periods]);
  const type = types.find((x) => x.id === typeId);
  const period = periodById.get(contractId);
  const suggestion = type && period ? suggestContentId(shortName, type.code, period.code, [...contents.map((x) => x.code), ...justAdded]) : "";
  const code = typed ?? suggestion;

  const active = contents.filter((x) => !x.archived && (filter === "all" || x.contentTypeId === filter));
  const archived = contents.filter((x) => x.archived);
  // Types that exist on this customer's content but are archived in Settings still get a filter chip.
  const filterTypes = [...types, ...contents.filter((x) => !types.some((t2) => t2.id === x.contentTypeId)).map((x) => ({ id: x.contentTypeId, code: x.typeCode, name: x.typeName }))].filter(
    (x, i, all) => all.findIndex((y) => y.id === x.id) === i,
  );

  function run(action: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>, onOk?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) onOk?.();
        else show(errors[result.error], "error");
      } catch {
        show(errors.generic, "error");
      }
    });
  }


  const contentRow = (item: Content) => {
    const own = tasks.filter((x) => x.contentId === item.id);
    const live = own.filter((x) => !x.archived);
    const done = live.filter((x) => x.finished).length;
    const open = expanded.includes(item.id);
    const publish = publishDates[item.id];
    return (
      <div key={item.id} data-row className={`flex flex-col gap-2 ${item.archived ? rowOff : row}`}>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          <button
            type="button"
            aria-expanded={open}
            aria-label={fill(taskT.contents.showTasks, { code: item.code })}
            onClick={() => setExpanded((list) => (open ? list.filter((x) => x !== item.id) : [...list, item.id]))}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-icon"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d={open ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6"} /></svg>
          </button>
          <div className="min-w-0 flex-[1_1_200px]">
            {item.archived ? (
              <span className="px-2.5 font-mono text-[13px] font-medium">{item.code}</span>
            ) : (
              <InlineText mono value={item.code} label={t.editId} onSave={(next) => run(() => renameContent(item.id, next))} />
            )}
            <Collapse open={!!item.note && !open}>
              <span className="flex min-w-0 items-center gap-1.5 px-2.5 pt-0.5 text-[12.5px] text-sun-ink">
                <PinIcon size={13} />
                <span className="truncate">{item.note}</span>
              </span>
            </Collapse>
          </div>
          <span className="whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{item.typeName}</span>
          {own.some((x) => x.hasFinishedWork) && <FinishedTag f={taskT.finished} onOpen={() => setFinishedOf(item.id)} />}
          <span className="whitespace-nowrap text-[13px] text-ink-soft">{publish ? fill(taskT.form.publishes, { date: shortDate(publish, taskT) }) : taskT.form.noPublish}</span>
          <span className="flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
            {live.length > 0 && (
              <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-track"><span className="bg-teal" style={{ width: `${Math.round((done / live.length) * 100)}%` }} /></span>
            )}
            {live.length ? fill(taskT.contents.progress, { done, total: live.length }) : t.noTasks}
          </span>
          {canArchive && (
            <button type="button" className={`${btn.soft} ml-auto`} disabled={pending} onClick={() => run(() => setContentArchived(item.id, !item.archived))}>
              {item.archived ? t.restore : t.archive}
            </button>
          )}
        </div>
        <Collapse open={open}>
          <div className="flex flex-col gap-2">
          {!item.archived && <NoteBox item={item} taskCount={live.length} t={t} taskT={taskT} errors={errors} onDone={(text) => show(text)} onError={(text) => show(text, "error")} />}
          <div className="flex flex-col rounded-2xl bg-surface px-3.5 py-1.5">
            {own.map((x, i) => (
              <div key={x.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-[13px] text-ink-soft ${i ? "border-t border-line" : ""}`}>
                <span className="flex-[1_1_150px] text-sm font-semibold text-ink">{x.typeDeleted ? fill(taskT.deletedType, { name: x.typeName }) : x.typeName}</span>
                <span className="flex flex-[1_1_150px] items-center gap-2">{x.assignees.length ? x.assignees.map((p) => p.name).join(", ") : taskT.noAssignee}</span>
                <span className="whitespace-nowrap">{shortDate(x.dueDate, taskT)}</span>
                <span className="flex min-w-[130px] items-center gap-1.5 whitespace-nowrap font-semibold text-ink">
                  <span className="size-[9px] rounded-full" style={{ background: x.archived ? "var(--color-subtle)" : x.statusColor }} />
                  {x.archived ? taskT.contents.archivedTask : x.statusDeleted ? fill(taskT.deletedStatus, { name: x.statusName }) : x.statusName}
                </span>
                {x.archived && canArchive && (
                  <button type="button" className={btn.mint} disabled={pending} onClick={() => run(() => setTaskArchived(x.id, false))}>
                    {taskT.form.restore}
                  </button>
                )}
              </div>
            ))}
            {own.length === 0 && <p className="py-3 text-[13px] text-muted">{t.noTasks}</p>}
          </div>
          </div>
        </Collapse>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-label={t.addTitle} className={card}>
        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedControl
            label={t.type}
            value={filter}
            onChange={setFilter}
            className="max-w-full overflow-x-auto"
            items={[{ id: "all", name: t.all }, ...filterTypes].map((x) => ({ key: x.id, label: x.name }))}
          />
          <Link href={`/customers/${customerId}?tab=tasks&plan=1`} className={`${btn.mint} ml-auto`}>
            {taskT.plan.openFromContents}
          </Link>
          <button type="button" className={btn.primary} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            {t.add}
          </button>
        </div>

        {adding && (
          <form
            className="flex flex-col gap-4 rounded-[22px] bg-mint p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              startTransition(async () => {
                const result = await addContent(customerId, typeId, contractId, code, note);
                if (!result.ok) return setFormError(errors[result.error]);
                show(fill(t.saved, { code }));
                setNote("");
                setJustAdded((list) => [...list, code]);
                setTyped(null);
              });
            }}
          >
            <h3 className="text-base font-semibold">{t.addTitle}</h3>
            {periods.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.needContract}</p>
            ) : types.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noTypes}</p>
            ) : (
              <>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {t.type}
                    <select className={field} value={typeId} onChange={(e) => (setTypeId(e.target.value), setTyped(null))}>
                      {types.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} ({x.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {t.period}
                    <select className={field} value={contractId} onChange={(e) => (setContractId(e.target.value), setTyped(null))}>
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.code})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  {t.id}
                  <input
                    className={`${field} font-mono text-sm`}
                    value={code}
                    onChange={(e) => setTyped(e.target.value.toLowerCase())}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={60}
                  />
                </label>
                <p className={`-mt-2 text-[13px] ${formError ? "font-medium text-danger" : "text-ink-soft"}`} role={formError ? "alert" : undefined}>
                  {formError ?? t.suggestHelp}
                </p>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  <span>
                    {t.noteLabel} <span className="font-medium text-muted">· {t.noteHelp}</span>
                  </span>
                  <NoteArea value={note} onChange={setNote} label={t.noteLabel} />
                  <span className="self-end text-xs font-medium text-muted tabular-nums">{fill(t.noteCount, { n: note.length, max: CONTENT_NOTE_MAX })}</span>
                </label>
                <div className="flex flex-wrap gap-2.5">
                  <button type="submit" className={btn.primary} disabled={pending || !code}>
                    {t.save}
                  </button>
                  <button type="button" className={btn.soft} onClick={() => setAdding(false)}>
                    {t.cancel}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        <div className="flex flex-col gap-2.5">
          {active.map(contentRow)}
          {active.length === 0 && <p className="py-5 text-center text-sm text-muted">{filter === "all" ? t.empty : t.emptyType}</p>}
        </div>
      </section>

      {archived.length > 0 && (
        <section aria-label={t.archivedTitle} className={card}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="flex-1 text-base font-semibold">{t.archivedTitle}</h3>
            <span className="text-[13px] text-muted">{t.archivedHelp}</span>
          </div>
          <div className="flex flex-col gap-2.5">{archived.map(contentRow)}</div>
        </section>
      )}
      {finishedOf && <FinishedWindow contentId={finishedOf} onClose={() => setFinishedOf(null)} t={taskT} />}
      <Toast message={message} />
    </div>
  );
}

/** A box for a content ID's note that grows with its text. */
function NoteArea({ value, onChange, label, autoFocus = false }: { value: string; onChange: (text: string) => void; label: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // Only with a mouse: on a phone the keyboard would jump up on its own.
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={value}
      maxLength={CONTENT_NOTE_MAX}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      className={`${field} min-h-[76px] resize-none py-2.5 font-normal leading-normal [field-sizing:content]`}
    />
  );
}

const bakuWhen = (at: Date, taskT: Dictionary["tasks"]) => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(at);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return `${shortDate(day, taskT)}, ${clock}`;
};

/**
 * The note of a content ID in its opened row: the note in a yellow box with Edit, an editor that
 * opens in place (empty it and save to remove the note), or "+ Add note for all its tasks".
 */
function NoteBox({
  item,
  taskCount,
  t,
  taskT,
  errors,
  onDone,
  onError,
}: {
  item: Content;
  taskCount: number;
  t: Dictionary["customers"]["contents"];
  taskT: Dictionary["tasks"];
  errors: Dictionary["errors"];
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [shown, setShown] = useState({ note: item.note, by: item.noteBy, at: item.noteAt });
  const [seen, setSeen] = useState(item);
  if (seen !== item) {
    setSeen(item);
    setShown({ note: item.note, by: item.noteBy, at: item.noteAt });
  }
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const edit = () => {
    setText(shown.note ?? "");
    setEditing(true);
  };
  const save = () =>
    startTransition(async () => {
      const result = await setContentNote(item.id, text);
      if (!result.ok) return onError(errors[result.error] ?? errors.generic);
      setShown({ note: result.note ?? null, by: result.by ?? null, at: result.at ? new Date(result.at) : null });
      setEditing(false);
      onDone(result.note ? t.noteSaved : t.noteRemoved);
    });
  const shared = taskCount === 0 ? t.noteShared0 : taskCount === 1 ? t.noteShared1 : fill(t.noteShared, { n: taskCount });
  return (
    <div className="flex flex-col">
      <Collapse open={!editing && !!shown.note}>
        <section aria-label={t.noteLabel} className="flex flex-col gap-1.5 rounded-2xl bg-sun-tint px-3.5 py-3">
          <div className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-wider text-sun-ink">
            <PinIcon />
            <span className="flex-1">{t.noteLabel}</span>
            <button type="button" aria-label={fill(t.noteEditOf, { code: item.code })} onClick={edit} className="flex min-h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-bold normal-case tracking-normal text-ink">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              {t.noteEdit}
            </button>
          </div>
          <p className="whitespace-pre-line text-sm leading-normal text-ink-body [overflow-wrap:anywhere]">{shown.note}</p>
          {shown.by && shown.at && <span className="text-xs text-muted">{fill(t.noteBy, { name: shown.by, when: bakuWhen(shown.at, taskT) })}</span>}
        </section>
      </Collapse>
      <Collapse open={!editing && !shown.note}>
        <button type="button" onClick={edit} className="flex min-h-9 items-center gap-1.5 self-start rounded-full border-[1.5px] border-dashed border-ink/35 bg-surface/60 px-3 text-[13px] font-bold text-ink hover:bg-surface">
          <span aria-hidden="true" className="text-base leading-none">+</span>
          {t.noteAdd}
        </button>
      </Collapse>
      <Collapse open={editing}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-sun bg-surface p-3"
        >
          <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-sun-ink">{t.noteLabel}</span>
          {editing && <NoteArea value={text} onChange={setText} label={t.noteLabel} autoFocus />}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-[1_1_220px] text-xs text-muted">
              {shared}
              {shown.note ? ` ${t.noteEmptyHint}` : ""}
            </span>
            <span className="text-xs text-muted tabular-nums">{fill(t.noteCount, { n: text.length, max: CONTENT_NOTE_MAX })}</span>
            <button type="button" onClick={() => setEditing(false)} className="min-h-10 rounded-full bg-mint px-4 text-[13px] font-semibold">
              {t.noteCancel}
            </button>
            <button type="submit" disabled={pending || (!text.trim() && !shown.note)} className="min-h-10 rounded-full bg-sun px-4 text-[13px] font-bold text-ink disabled:opacity-50">
              {t.noteSave}
            </button>
          </div>
        </form>
      </Collapse>
    </div>
  );
}
