"use client";

import { useState, useTransition } from "react";
import { addBriefField, removeBriefField, reorderBriefFields, restoreBriefField, updateBriefField } from "@/app/actions/brief-fields";
import { ConfirmBar } from "@/components/confirm-bar";
import { shrinkOut, UndoToast, useGrowIn, useUndoToast } from "@/components/list-motion";
import { Collapse, SegmentedControl } from "@/components/motion";
import { SortableList, type Handle } from "@/components/sortable-list";
import { Switch } from "@/components/switch";
import { Toast, useToast } from "@/components/toast";
import { card } from "@/components/ui";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { BRIEF_LIMITS, BRIEF_TYPES, type BriefTemplateField, type BriefType } from "@/lib/brief-rules";
import { SectionHeader } from "./section-header";

type Row = BriefTemplateField & { fresh?: boolean };
type S = Dictionary["settings"]["brief"];

const ICONS: Record<BriefType, string> = { short: "T", long: "¶", links: "🔗", checklist: "☑", date: "📅" };
const field = "h-11 w-full min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted";

/**
 * Settings → Content brief: the fields every new brief starts with. Rows stay short until opened
 * (one at a time); new rows grow in, removed ones shrink away with Undo, and rows can be dragged.
 */
export function BriefFieldsSection({ fields, t, errors }: { fields: BriefTemplateField[]; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const s = t.brief;
  const [rows, setRows] = useState<Row[]>(fields);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ label: "", labelEn: "", type: "short" as BriefType });
  const [, startTransition] = useTransition();
  const { message, show } = useToast();
  const undo = useUndoToast();
  const fail = (key: ErrorKey) => show(errors[key] ?? errors.generic, "error");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.label.trim()) return;
    startTransition(async () => {
      const result = await addBriefField(draft);
      if (!result.ok) return fail(result.error);
      setRows((list) => [...list, { ...result.field, fresh: true }]);
      setDraft({ label: "", labelEn: "", type: draft.type });
      undo.show(fill(s.added, { name: result.field.label }), s.undo);
    });
  };

  const save = (id: string, patch: Partial<BriefTemplateField>) => {
    const before = rows;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(async () => {
      const result = await updateBriefField(id, patch);
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  const remove = (row: Row, el: HTMLElement | null) =>
    shrinkOut(el, () => {
      setRows((list) => list.filter((r) => r.id !== row.id));
      setOpenId(null);
      startTransition(async () => {
        const result = await removeBriefField(row.id);
        if (!result.ok) return fail(result.error);
        undo.show(fill(s.removed, { name: row.label }), s.undo, () =>
          startTransition(async () => {
            const back = await restoreBriefField(result.field, result.index);
            if (!back.ok) return fail(back.error);
            setRows((list) => {
              const next = [...list];
              next.splice(Math.min(result.index, next.length), 0, { ...result.field, fresh: true });
              return next;
            });
          }),
        );
      });
    });

  const reorder = (ids: string[]) => {
    const before = rows;
    setRows((list) => ids.map((id) => list.find((r) => r.id === id)!).filter(Boolean));
    startTransition(async () => {
      const result = await reorderBriefFields(ids);
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  const types = BRIEF_TYPES.map((key) => ({ key, label: `${ICONS[key]} ${s.types[key]}` }));

  return (
    <section aria-label={t.sections.brief} className={card}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <SectionHeader title={t.sections.brief} intro={s.intro} />
        </div>
        {rows.length < BRIEF_LIMITS.template && (
          <button type="button" aria-expanded={adding} onClick={() => setAdding((v) => !v)} className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-sun px-[18px] text-sm font-bold text-ink">
            <span aria-hidden="true" className={`inline-block text-base leading-none transition-transform duration-300 ${adding ? "rotate-45" : ""}`}>+</span>
            {s.add}
          </button>
        )}
      </div>

      <Collapse open={adding}>
        <form onSubmit={add} className="mb-1 flex flex-wrap items-center gap-2.5 rounded-[22px] bg-mint p-3.5">
          <input className={`${field} flex-[1_1_200px]`} aria-label={s.nameAz} placeholder={s.nameAz} value={draft.label} maxLength={BRIEF_LIMITS.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <input className={`${field} flex-[1_1_180px]`} aria-label={s.nameEn} placeholder={s.nameEn} value={draft.labelEn} maxLength={BRIEF_LIMITS.label} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} />
          <SegmentedControl label={s.type} items={types} value={draft.type} onChange={(type) => setDraft({ ...draft, type: type as BriefType })} tone="teal" itemClassName="min-h-9 px-3 text-[13px]" />
          <span className="flex flex-1 justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold">
              {s.cancel}
            </button>
            <button type="submit" disabled={!draft.label.trim()} className="min-h-11 rounded-full bg-sun px-4 text-sm font-bold text-ink disabled:opacity-50">
              {s.add}
            </button>
          </span>
        </form>
      </Collapse>

      {rows.length === 0 && <p className="py-4 text-sm text-muted">{s.empty}</p>}
      <SortableList items={rows} onReorder={reorder}>
        {(row, _i, handle) => (
          <FieldRow
            row={row}
            handle={handle}
            open={openId === row.id}
            onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
            onSave={(patch) => save(row.id, patch)}
            onRemove={(el) => remove(row, el)}
            s={s}
            types={types}
          />
        )}
      </SortableList>

      {rows.some((r) => !r.visible) && <p className="rounded-[16px] bg-sun-tint px-4 py-3 text-[13px] leading-normal text-sun-ink">{s.hiddenInfo}</p>}
      <Toast message={message} />
      <UndoToast offer={undo.offer} onClose={undo.close} />
    </section>
  );
}

function FieldRow({
  row,
  handle,
  open,
  onToggle,
  onSave,
  onRemove,
  s,
  types,
}: {
  row: Row;
  handle: Handle;
  open: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<BriefTemplateField>) => void;
  onRemove: (el: HTMLElement | null) => void;
  s: S;
  types: { key: string; label: string }[];
}) {
  const ref = useGrowIn<HTMLDivElement>(!!row.fresh);
  const [confirming, setConfirming] = useState(false);
  const panelId = `brief-field-${row.id}`;
  return (
    <div ref={ref} data-row className={`rounded-[20px] transition-colors duration-300 ${open ? "bg-mint" : "bg-mint-soft"}`}>
      <div className={`flex min-h-[62px] items-center gap-3 px-3 py-2.5 ${row.visible ? "" : "opacity-75"}`}>
        {handle(fill(s.reorder, { name: row.label }))}
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-teal-tint text-sm font-extrabold text-teal-deep">{ICONS[row.type]}</span>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-[15px] font-semibold">{row.label}</span>
          {row.labelEn && <span className="truncate text-[12.5px] text-muted">{row.labelEn}</span>}
        </button>
        {!row.visible && <span className="whitespace-nowrap rounded-full bg-sun-tint px-2.5 py-1 text-[11.5px] font-bold text-sun-ink">{s.hidden}</span>}
        <span className="hidden whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-bold text-ink-soft sm:inline">{s.typeNames[row.type]}</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label={fill(s.open, { name: row.label })}
          aria-expanded={open}
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "rotate-180 bg-surface" : ""}`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <Collapse open={open}>
        <div id={panelId} className="flex flex-col gap-3.5 px-3.5 pb-3.5 sm:pl-[106px]">
          <Line label={s.name}>
            <Lang tag="AZ">
              <SavedInput value={row.label} label={s.nameAz} required onSave={(label) => onSave({ label })} />
            </Lang>
            <Lang tag="EN">
              <SavedInput value={row.labelEn ?? ""} label={s.nameEn} placeholder={s.nameEn} onSave={(labelEn) => onSave({ labelEn: labelEn || null })} />
            </Lang>
          </Line>
          <Line label={s.type}>
            <SegmentedControl label={s.type} items={types} value={row.type} onChange={(type) => onSave({ type: type as BriefType })} tone="teal" itemClassName="min-h-9 px-3 text-[13px]" />
          </Line>
          <Line label={s.hint}>
            <Lang tag="AZ">
              <SavedInput value={row.hint} label={s.hintAz} placeholder={s.hintAz} max={BRIEF_LIMITS.hint} onSave={(hint) => onSave({ hint })} />
            </Lang>
            <Lang tag="EN">
              <SavedInput value={row.hintEn ?? ""} label={s.hintEn} placeholder={s.hintEn} max={BRIEF_LIMITS.hint} onSave={(hintEn) => onSave({ hintEn: hintEn || null })} />
            </Lang>
          </Line>
          <Line label={s.show}>
            <Switch label={s.inNewBriefs} checked={row.visible} onChange={(visible) => onSave({ visible })} />
          </Line>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line-strong pt-3">
            {confirming ? (
              <div className="flex-1">
                <ConfirmBar text={fill(s.confirmRemove, { name: row.label })} confirmLabel={s.remove} cancelLabel={s.cancel} onCancel={() => setConfirming(false)} onConfirm={() => onRemove(ref.current)} />
              </div>
            ) : (
              <>
                <span className="flex-[1_1_220px] text-[12.5px] text-muted">{s.hintHelp}</span>
                <button type="button" onClick={() => setConfirming(true)} className="min-h-10 rounded-full bg-danger/10 px-4 text-[13px] font-bold text-danger">
                  {s.remove}
                </button>
              </>
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="w-full text-xs font-bold uppercase tracking-wider text-muted sm:w-[92px] sm:shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Lang({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-[1_1_220px] items-center gap-2">
      <span aria-hidden="true" className="rounded-md bg-surface px-1.5 py-0.5 text-[10.5px] font-extrabold text-muted">{tag}</span>
      {children}
    </span>
  );
}

/** A text box that saves when you leave it or press Enter (Escape puts the saved text back). */
function SavedInput({ value, label, placeholder, required = false, max = BRIEF_LIMITS.label, onSave }: { value: string; label: string; placeholder?: string; required?: boolean; max?: number; onSave: (next: string) => void }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  const commit = () => {
    const next = text.trim();
    if (next === value || (required && !next)) return setText(value);
    onSave(next);
  };
  return (
    <input
      aria-label={label}
      placeholder={placeholder}
      value={text}
      maxLength={max}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setText(value);
      }}
      className={`${field} h-10 flex-1`}
    />
  );
}
