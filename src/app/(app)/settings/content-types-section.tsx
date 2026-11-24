"use client";

import { useState, useTransition } from "react";
import { shrinkOut, UndoToast, useUndoToast } from "@/components/list-motion";
import { card } from "@/components/ui";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { addContentType, renameContentType, setContentTypeArchived, setContentTypeCode } from "./actions";
import { AddButton, AddForm, FormButtons, Group, inputCls, Line, SavedInput, SectionTop, SettingsRow, useFresh } from "./settings-ui";

type ContentType = { id: string; code: string; name: string; archived: boolean; used: number };

/**
 * Settings → Content types: a code chip, the name and how many content IDs use it (a small bar).
 * Archiving moves a type into the folded "Archived" group; Restore brings it back.
 */
export function ContentTypesSection({ types, t, errors }: { types: ContentType[]; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const c = t.content;
  const [rows, setRows] = useState(types);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ code: "", name: "" });
  const [, startTransition] = useTransition();
  const undo = useUndoToast();
  // One message area for everything (errors too), so two messages never sit on top of each other.
  const show = (text: string) => undo.show(text, t.undo);
  const { isFresh, mark } = useFresh();
  const fail = (key: ErrorKey) => show(errors[key] ?? errors.generic);
  const max = Math.max(1, ...rows.map((r) => r.used));

  const change = (id: string, patch: Partial<ContentType>, save: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>) => {
    const before = rows;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(async () => {
      const result = await save();
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  const add = () =>
    startTransition(async () => {
      const result = await addContentType(draft.code, draft.name);
      if (!result.ok || !result.id) return fail(result.ok ? "generic" : result.error);
      setRows((list) => [...list, { id: result.id!, code: result.code!, name: result.name!, archived: false, used: 0 }]);
      mark(result.id);
      setDraft({ code: "", name: "" });
      undo.show(fill(t.addedToast, { name: result.name! }), t.undo);
    });

  // Archive or restore: the row folds away and appears in the other list.
  const move = (row: ContentType, archived: boolean, el: HTMLElement | null) =>
    startTransition(async () => {
      const result = await setContentTypeArchived(row.id, archived);
      if (!result.ok) return fail(result.error);
      shrinkOut(el, () => {
        setOpenId(null);
        setRows((list) => [...list.filter((r) => r.id !== row.id), { ...row, archived }]);
        mark(row.id);
      });
      undo.show(fill(archived ? c.archivedToast : c.restoredToast, { name: row.name }), t.undo, () =>
        startTransition(async () => {
          const back = await setContentTypeArchived(row.id, !archived);
          if (!back.ok) return fail(back.error);
          setRows((list) => [...list.filter((r) => r.id !== row.id), { ...row, archived: !archived }]);
          mark(row.id);
        }),
      );
    });

  const rowOf = (row: ContentType) => (
    <SettingsRow
      key={row.id}
      id={row.id}
      fresh={isFresh(row.id)}
      open={openId === row.id}
      onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
      openLabel={fill(t.open, { name: row.name })}
      muted={row.archived}
      lead={<span className="min-w-[86px] shrink-0 rounded-xl bg-surface px-3 py-[7px] text-center font-mono text-sm font-semibold">{row.code}</span>}
      title={row.name}
      subtitle={
        <span className="flex items-center gap-2">
          {row.used > 0 && (
            <span aria-hidden="true" className="inline-block h-[5px] w-[70px] overflow-hidden rounded-full bg-track">
              <span className="block h-full bg-teal" style={{ width: `${(row.used / max) * 100}%` }} />
            </span>
          )}
          {row.used > 0 ? fill(c.used, { count: row.used }) : c.unused}
        </span>
      }
      action={
        <MoveButton label={row.archived ? c.restore : c.archive} sun={row.archived} onMove={(el) => move(row, !row.archived, el)} />
      }
    >
      <Line label={c.name}>
        <SavedInput value={row.name} label={c.name} required onSave={(name) => change(row.id, { name }, () => renameContentType(row.id, name))} />
      </Line>
      <Line label={c.code}>
        {row.used > 0 ? (
          <span className="text-[13px] text-muted">{errors.codeLocked}</span>
        ) : (
          <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
            <SavedInput value={row.code} label={c.code} mono max={10} required onSave={(code) => change(row.id, { code }, () => setContentTypeCode(row.id, code))} />
            <span className="text-xs text-muted">{c.codeHelp}</span>
          </span>
        )}
      </Line>
    </SettingsRow>
  );

  const active = rows.filter((r) => !r.archived);
  const archived = rows.filter((r) => r.archived);
  return (
    <section aria-label={t.sections.content} className={card}>
      <SectionTop title={t.sections.content} intro={c.intro} add={<AddButton label={c.add} open={adding} onClick={() => setAdding((v) => !v)} />} />
      <AddForm open={adding} onSubmit={add}>
        <input
          className={`${inputCls} flex-[0_1_140px] font-mono text-sm`}
          aria-label={c.code}
          placeholder={c.codePlaceholder}
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) })}
          autoComplete="off"
          spellCheck={false}
        />
        <input className={`${inputCls} flex-[1_1_200px]`} aria-label={c.name} placeholder={c.name} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
        <FormButtons cancel={t.cancel} submit={c.add} onCancel={() => setAdding(false)} disabled={!draft.code || !draft.name.trim()} />
        <p className="basis-full text-xs text-muted">{c.codeHelp}</p>
      </AddForm>
      <div className="flex flex-col gap-2.5">{active.map(rowOf)}</div>
      <Group label={fill(c.archivedGroup, { n: archived.length })} count={archived.length}>
        {archived.map(rowOf)}
      </Group>
      <UndoToast offer={undo.offer} onClose={undo.close} />
    </section>
  );
}

/** Archive / Restore on the row itself; it needs the row element to fold it away. */
function MoveButton({ label, sun, onMove }: { label: string; sun: boolean; onMove: (el: HTMLElement | null) => void }) {
  return (
    <button type="button" onClick={(e) => onMove(e.currentTarget.closest<HTMLElement>("[data-row]"))} className={`min-h-10 shrink-0 rounded-full px-4 text-[13px] font-bold ${sun ? "bg-sun text-ink" : "bg-surface text-ink"}`}>
      {label}
    </button>
  );
}
