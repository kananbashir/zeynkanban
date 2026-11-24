"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteBrief, loadBrief, saveBrief, type BriefView } from "@/app/actions/briefs";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { BRIEF_LIMITS, BRIEF_TYPES, emptyValue, linkSite, type BriefField, type BriefLink, type BriefType } from "@/lib/brief-rules";
import { weekdayIndex } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { CloseButton, ConfirmDialog, Dialog } from "./dialog";
import { shrinkOut, UndoToast, useGrowIn, useUndoToast } from "./list-motion";
import { SortableList, type Handle } from "./sortable-list";

type T = Dictionary["tasks"];

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).slice(0, 12);

const ICONS: Record<BriefType, string> = { short: "T", long: "¶", links: "🔗", checklist: "☑", date: "📅" };

/** A small pop for things that appear (a menu, a mode switch); nothing with reduced motion. */
function popIn(el: HTMLElement | null, from = "translateY(6px) scale(0.98)") {
  if (el && !prefersReducedMotion()) el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 380, easing: springOrFallback(420, 30, 0.38) });
}

/** The small dark "Brief" tag after a card's content ID; opens the brief. */
export function BriefTag({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex items-center gap-1.5 rounded-lg bg-ink px-2 py-1 text-xs font-bold text-surface">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />
      </svg>
      {label}
    </button>
  );
}

/** The dashed "+ Add content brief" button admins and managers see on cards without a brief. */
export function AddBriefButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-ink/35 bg-surface/50 px-3 text-[13px] font-semibold text-ink hover:bg-surface">
      <span aria-hidden="true" className="text-base leading-none">+</span>
      {label}
    </button>
  );
}

/**
 * A content brief in a window, above everything (also above a task window): read it, or (admins
 * and managers) write, edit or delete it. Switching between reading and writing fades across.
 */
export function BriefWindow({ contentId, startEditing, onClose, t }: { contentId: string; startEditing: boolean; onClose: () => void; t: T }) {
  const b = t.brief;
  const router = useRouter();
  const [brief, setBrief] = useState<BriefView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const body = useRef<HTMLDivElement>(null);
  const message = useCallback((key: string) => (b.errors as Record<string, string>)[key] ?? b.errors.generic, [b.errors]);
  const stopConfirming = useCallback(() => setConfirming(false), []);

  useEffect(() => {
    let alive = true;
    loadBrief(contentId).then((result) => {
      if (!alive) return;
      if (!result.ok) return setError(message(result.error));
      setBrief(result.brief);
      setEditing(result.brief.canEdit && (startEditing || !result.brief.fields.length));
    });
    return () => {
      alive = false;
    };
  }, [contentId, startEditing, message]);
  // Fade across when the brief arrives or when switching between reading and writing.
  useLayoutEffect(() => popIn(body.current, "translateY(8px)"), [editing, !!brief]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = () =>
    startTransition(async () => {
      const result = await deleteBrief(contentId);
      if (!result.ok) return setError(message(result.error));
      router.refresh();
      onClose();
    });

  const isNew = !!brief && !brief.fields.length;
  const window = (
    <Dialog label={brief ? `${b.title} · ${brief.code}` : b.title} onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-teal-deep">{b.title}</span>
          <h2 className="break-all font-mono text-xl font-semibold sm:text-2xl">{brief?.code ?? "…"}</h2>
          {brief && (
            <span className="text-[13px] text-ink-soft">
              {brief.customer} · {brief.typeName}
              {editing && brief.taskCount > 0 ? ` · ${brief.taskCount === 1 ? b.shared1 : fill(b.sharedN, { n: brief.taskCount })}` : ""}
            </span>
          )}
        </div>
        <CloseButton label={b.close} onClick={onClose} />
      </div>
      <div ref={body} className="flex flex-col gap-3">
        {!brief && !error && <p className="py-6 text-center text-sm text-muted">{b.loading}</p>}
        {!brief && error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        {brief && editing && (
          <BriefEditor
            brief={brief}
            isNew={isNew}
            t={t}
            onCancel={() => (isNew ? onClose() : setEditing(false))}
            onSave={async (fields) => {
              const result = await saveBrief(contentId, fields);
              if (!result.ok) return { error: message(result.error), fieldId: result.fieldId };
              router.refresh();
              const fresh = await loadBrief(contentId);
              if (fresh.ok) setBrief(fresh.brief);
              setEditing(false);
              return null;
            }}
          />
        )}
        {brief && !editing && (
          <>
            <BriefReader fields={brief.fields} t={t} />
            {(brief.createdBy || brief.updatedBy) && (
              <p className="text-[12.5px] text-muted">
                {[brief.createdBy && fill(b.added, { name: brief.createdBy, when: brief.createdOn ?? "" }), brief.updatedBy && fill(b.edited, { name: brief.updatedBy, when: brief.updatedOn ?? "" })].filter(Boolean).join(" · ")}
              </p>
            )}
            {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
            <div className="flex flex-wrap items-center gap-2.5">
              {brief.canEdit && (
                <button type="button" onClick={() => setConfirming(true)} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold text-danger">
                  {b.delete}
                </button>
              )}
              <span className="flex-1" />
              <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
                {b.close}
              </button>
              {brief.canEdit && (
                <button type="button" onClick={() => setEditing(true)} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink">
                  {b.edit}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {confirming && brief && (
        <ConfirmDialog title={b.deleteTitle} text={fill(b.deleteText, { code: brief.code })} confirmLabel={b.delete} cancelLabel={b.cancel} pending={pending} onCancel={stopConfirming} onConfirm={remove} />
      )}
    </Dialog>
  );
  return typeof document === "undefined" ? null : createPortal(window, document.body);
}

/** A brief as read by everyone: each field under its name; links open in a new tab and show their site. */
function BriefReader({ fields, t }: { fields: BriefField[]; t: T }) {
  const b = t.brief;
  return (
    <div className="flex flex-col gap-2.5">
      {fields.map((f) => (
        <section key={f.id} aria-label={f.label} className="flex flex-col gap-2 rounded-[20px] bg-surface px-4 py-3.5">
          <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-muted">{f.label}</h3>
          {(f.type === "short" || f.type === "long") && <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-body">{f.value}</p>}
          {f.type === "date" && (
            <p className="text-[15px] font-semibold">
              {t.weekdays[weekdayIndex(f.value)]}, {shortDate(f.value, t)} {f.value.slice(0, 4)}
            </p>
          )}
          {f.type === "checklist" && (
            <ul className="flex flex-col gap-1.5">
              {f.value.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px] leading-snug">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-teal">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          )}
          {f.type === "links" &&
            f.value.map((l, i) => {
              const site = linkSite(l.url);
              return (
                <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[14px] border border-line bg-mint-soft px-3 py-2.5 hover:bg-mint">
                  <SiteBadge kind={site.kind} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">{l.name}</span>
                    <span className="truncate text-xs text-muted">{site.host}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-teal-deep">
                    {b.open} <span aria-hidden="true">↗</span>
                  </span>
                </a>
              );
            })}
        </section>
      ))}
    </div>
  );
}

const SITES: Record<ReturnType<typeof linkSite>["kind"], [string, string]> = {
  drive: ["D", "#1e8e3e"],
  docs: ["G", "#1a73e8"],
  instagram: ["IG", "#c13584"],
  youtube: ["▶", "#d93025"],
  tiktok: ["TT", "#111827"],
  figma: ["F", "#7b3fe4"],
  dropbox: ["DB", "#0061fe"],
  facebook: ["f", "#1877f2"],
  other: ["↗", "#0b7f7b"],
};
export function SiteBadge({ kind }: { kind: keyof typeof SITES }) {
  const [text, color] = SITES[kind];
  return (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-[12px] font-extrabold text-white" style={{ background: color }}>
      {text}
    </span>
  );
}

/** A field being written; `fresh` ones grow into place (just added, reset, or brought back by Undo). */
type Draft = BriefField & { fresh?: boolean };
type Problem = { error: string; fieldId?: string } | null;

const fromTemplate = (f: BriefView["template"][number]): Draft => ({ id: newId(), label: f.label, hint: f.hint || undefined, type: f.type, value: emptyValue(f.type), fresh: true }) as Draft;
const typed = (f: BriefField) => (Array.isArray(f.value) ? f.value.some((x) => (typeof x === "string" ? x.trim() : x.url.trim() || x.name.trim())) : !!f.value.trim());

/**
 * Writing a brief. A new one starts from the starting fields in Settings; fields can be renamed,
 * moved, removed (with Undo) and added (by type, or a hidden starting field). Empty ones are left out.
 */
function BriefEditor({ brief, isNew, t, onCancel, onSave }: { brief: BriefView; isNew: boolean; t: T; onCancel: () => void; onSave: (fields: Draft[]) => Promise<Problem> }) {
  const b = t.brief;
  const starting = brief.template.filter((f) => f.visible);
  const [fields, setFields] = useState<Draft[]>(() =>
    brief.fields.length ? brief.fields.map((f) => ({ ...f, value: Array.isArray(f.value) ? [...f.value] : f.value }) as Draft) : starting.map((f) => ({ ...fromTemplate(f), fresh: false })),
  );
  const [menu, setMenu] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [askReset, setAskReset] = useState(false);
  const [pending, startTransition] = useTransition();
  const undo = useUndoToast();
  const keepTyping = useCallback(() => setAskReset(false), []);
  const focusNext = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // The menu opens downwards, or upwards when there isn't room below the button on the screen.
  const [menuUp, setMenuUp] = useState(false);
  useLayoutEffect(() => {
    if (!menu || !menuRef.current || !addRef.current) return;
    const button = addRef.current.getBoundingClientRect();
    const height = menuRef.current.offsetHeight + 12;
    const up = button.bottom + height > window.innerHeight && button.top - height > 0;
    setMenuUp(up);
    popIn(menuRef.current, up ? "translateY(6px) scale(0.96)" : "translateY(-6px) scale(0.96)");
  }, [menu]);

  const update = (id: string, patch: Partial<Draft>) => {
    setFields((list) => list.map((f) => (f.id === id ? ({ ...f, ...patch } as Draft) : f)));
    if (problem?.fieldId === id) setProblem(null); // being fixed: the message goes away
  };
  const add = (draft: Draft) => {
    focusNext.current = draft.id;
    setFields((list) => [...list, draft]);
    setMenu(false);
  };
  useEffect(() => {
    if (!focusNext.current) return;
    const el = document.querySelector<HTMLInputElement>(`[data-field="${focusNext.current}"] [data-label]`);
    el?.focus();
    el?.select();
    el?.closest("[data-field]")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
    focusNext.current = null;
  }, [fields.length]);

  const removeField = (field: Draft, el: HTMLElement | null) => {
    const index = fields.findIndex((f) => f.id === field.id);
    shrinkOut(el, () => {
      setFields((list) => list.filter((f) => f.id !== field.id));
      undo.show(fill(b.removedField, { name: field.label || b.fieldName }), b.undo, () =>
        setFields((list) => {
          const next = [...list];
          next.splice(Math.min(index, next.length), 0, { ...field, fresh: true });
          return next;
        }),
      );
    });
  };
  const reset = () => {
    setFields(starting.map(fromTemplate));
    setAskReset(false);
    setProblem(null);
  };

  const save = () =>
    startTransition(async () => {
      setProblem(null);
      const result = await onSave(fields.map(({ fresh: _fresh, ...f }) => f as BriefField)); // eslint-disable-line @typescript-eslint/no-unused-vars
      if (result) {
        setProblem(result);
        if (result.fieldId) document.querySelector(`[data-field="${result.fieldId}"]`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      }
    });

  // Starting fields not in the brief right now (hidden in Settings, or removed here) can be added back.
  const present = new Set(fields.map((f) => f.label));
  const extra = brief.template.filter((f) => !present.has(f.label));

  return (
    <div className="flex flex-col gap-3">
      {isNew && starting.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-surface px-3.5 py-2.5 text-[13px] text-ink-soft">
          <span className="flex-[1_1_220px]">{fill(b.startedFrom, { n: starting.length })}</span>
          <button type="button" onClick={() => (fields.some(typed) ? setAskReset(true) : reset())} className="min-h-9 rounded-full bg-mint px-3.5 text-[13px] font-semibold text-ink hover:bg-teal-tint">
            {b.reset}
          </button>
        </div>
      )}

      <SortableList items={fields} onReorder={(ids) => setFields((list) => ids.map((id) => list.find((f) => f.id === id)!).filter(Boolean))}>
        {(f, _i, handle) => <FieldCard field={f} handle={handle} t={t} problem={problem?.fieldId === f.id ? problem.error : null} update={(patch) => update(f.id, patch)} onRemove={(el) => removeField(f, el)} />}
      </SortableList>

      {fields.length < BRIEF_LIMITS.fields && (
        <div className="relative">
          <button
            type="button"
            ref={addRef}
            aria-expanded={menu}
            aria-haspopup="true"
            onClick={() => setMenu((v) => !v)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line-strong bg-surface/50 text-[15px] font-semibold text-teal-deep hover:bg-surface"
          >
            <span aria-hidden="true" className={`inline-block transition-transform duration-300 ${menu ? "rotate-45" : ""}`}>+</span>
            {b.addField}
          </button>
          {menu && (
            <>
              <button data-no-press type="button" aria-label={b.close} tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div
                ref={menuRef}
                role="menu"
                aria-label={b.addField}
                className={`absolute left-0 right-0 ${menuUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"} z-20 mx-auto flex w-[min(360px,100%)] flex-col gap-0.5 rounded-[18px] bg-surface p-1.5 shadow-[0_14px_40px_rgba(24,35,47,0.22)]`}
              >
                {BRIEF_TYPES.map((type) => (
                  <button
                    key={type}
                    role="menuitem"
                    type="button"
                    onClick={() => add({ id: newId(), label: b.types[type][0], type, value: emptyValue(type), fresh: true } as Draft)}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-mint"
                  >
                    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-teal-tint text-sm font-extrabold text-teal-deep">{ICONS[type]}</span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{b.types[type][0]}</span>
                      <span className="text-xs text-muted">{b.types[type][1]}</span>
                    </span>
                  </button>
                ))}
                {extra.length > 0 && (
                  <>
                    <span className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">{b.fromSettings}</span>
                    {extra.map((f) => (
                      <button key={f.id} role="menuitem" type="button" onClick={() => add(fromTemplate(f))} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-mint">
                        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-mint text-sm font-extrabold text-teal-deep">{ICONS[f.type]}</span>
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold">{f.label}</span>
                          <span className="text-xs text-muted">{b.types[f.type][0]}</span>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <p role={problem ? "alert" : undefined} className={`flex-[1_1_240px] text-[13px] font-medium leading-snug ${problem ? "text-danger" : "text-ink-soft"}`}>
          {problem?.error ?? `${b.emptyHint} ${b.notifyHint}`}
        </p>
        <button type="button" onClick={onCancel} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
          {b.cancel}
        </button>
        <button type="button" onClick={save} disabled={pending} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink disabled:opacity-60">
          {isNew ? b.save : b.saveChanges}
        </button>
      </div>
      <UndoToast offer={undo.offer} onClose={undo.close} />
      {askReset && <ConfirmDialog title={b.resetTitle} text={b.resetText} confirmLabel={b.resetConfirm} cancelLabel={b.cancel} onCancel={keepTyping} onConfirm={reset} />}
    </div>
  );
}

/** One field while writing: drag handle, name, type, ✕, and the box(es) for its value. */
function FieldCard({ field: f, handle, t, problem, update, onRemove }: { field: Draft; handle: Handle; t: T; problem: string | null; update: (patch: Partial<Draft>) => void; onRemove: (el: HTMLElement | null) => void }) {
  const b = t.brief;
  const ref = useGrowIn<HTMLDivElement>(!!f.fresh);
  const input = "h-11 w-full min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted";
  const small = "flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-soft text-muted hover:bg-mint hover:text-ink";
  const placeholder = f.hint || (f.type === "long" ? b.placeholders.long : b.placeholders.short);
  return (
    <div ref={ref} data-field={f.id} className={`flex flex-col gap-2.5 rounded-[20px] bg-surface p-3 sm:p-3.5 ${problem ? "ring-2 ring-danger" : ""}`}>
      <div className="flex items-center gap-2">
        {handle(fill(b.reorder, { name: f.label || b.fieldName }))}
        <input
          data-label
          aria-label={b.fieldName}
          value={f.label}
          maxLength={BRIEF_LIMITS.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder={b.fieldName}
          className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-[15px] font-bold text-ink placeholder:font-normal placeholder:text-muted hover:bg-mint-soft focus:bg-mint-soft"
        />
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-ink-soft sm:flex">
          <span aria-hidden="true">{ICONS[f.type]}</span>
          {b.types[f.type][0]}
        </span>
        <button type="button" aria-label={fill(b.remove, { name: f.label || b.fieldName })} onClick={() => onRemove(ref.current)} className={small}>
          ✕
        </button>
      </div>
      {f.type === "short" && <input aria-label={f.label} className={input} value={f.value} maxLength={BRIEF_LIMITS.short} placeholder={placeholder} onChange={(e) => update({ value: e.target.value })} />}
      {f.type === "long" && <textarea aria-label={f.label} className={`${input} h-24 py-2.5 leading-normal`} value={f.value} maxLength={BRIEF_LIMITS.long} placeholder={placeholder} onChange={(e) => update({ value: e.target.value })} />}
      {f.type === "date" && <input type="date" aria-label={f.label} className={`${input} w-[190px]`} value={f.value} onChange={(e) => update({ value: e.target.value })} />}
      {f.type === "links" && (
        <>
          {f.value.map((l, i) => {
            const set = (patch: Partial<BriefLink>) => update({ value: f.value.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input aria-label={fill(b.linkNameOf, { n: i + 1 })} className={`${input} flex-[1_1_150px]`} value={l.name} maxLength={BRIEF_LIMITS.linkName} placeholder={b.linkName} onChange={(e) => set({ name: e.target.value })} />
                <input aria-label={fill(b.linkUrlOf, { n: i + 1 })} className={`${input} flex-[2_1_220px]`} value={l.url} inputMode="url" maxLength={BRIEF_LIMITS.url} placeholder={f.hint || b.linkUrl} onChange={(e) => set({ url: e.target.value })} />
                {f.value.length > 1 && (
                  <button type="button" aria-label={fill(b.removeLink, { n: i + 1 })} onClick={() => update({ value: f.value.filter((_, j) => j !== i) })} className={small}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {f.value.length < BRIEF_LIMITS.links && (
            <button type="button" onClick={() => update({ value: [...f.value, { name: "", url: "" }] })} className="self-start text-[13px] font-semibold text-teal-deep">
              + {b.anotherLink}
            </button>
          )}
        </>
      )}
      {f.type === "checklist" && (
        <>
          {f.value.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label={fill(b.itemOf, { n: i + 1 })} className={input} value={item} maxLength={BRIEF_LIMITS.item} placeholder={f.hint || b.item} onChange={(e) => update({ value: f.value.map((x, j) => (j === i ? e.target.value : x)) })} />
              {f.value.length > 1 && (
                <button type="button" aria-label={fill(b.removeItem, { n: i + 1 })} onClick={() => update({ value: f.value.filter((_, j) => j !== i) })} className={small}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {f.value.length < BRIEF_LIMITS.items && (
            <button type="button" onClick={() => update({ value: [...f.value, ""] })} className="self-start text-[13px] font-semibold text-teal-deep">
              + {b.anotherItem}
            </button>
          )}
        </>
      )}
      {problem && <p className="text-[13px] font-medium text-danger">{problem}</p>}
    </div>
  );
}
