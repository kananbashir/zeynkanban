"use client";

import { useState, useTransition } from "react";
import { shrinkOut, UndoToast, useUndoToast } from "@/components/list-motion";
import { SortableList } from "@/components/sortable-list";
import { Switch } from "@/components/switch";
import { card } from "@/components/ui";
import type { Dictionary, ErrorKey, Locale } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { localName } from "@/lib/names";
import { COLOR_NAMES, STATUS_COLORS } from "@/lib/settings-rules";
import { addStatus, deleteStatus, renameStatus, renameStatusEn, reorderStatuses, restoreStatus, setStatusCancelled, setStatusColor, setStatusFinished, setStatusPostponed, setStatusReview } from "./actions";
import { AddButton, AddForm, Badge, ColorSwatches, FormButtons, inputCls, Lang, Line, RowFoot, SavedInput, SectionTop, SettingsRow } from "./settings-ui";

type Status = { id: string; name: string; nameEn: string | null; color: string; isFinished: boolean; isCancelled: boolean; isPostponed: boolean; notifyReview: boolean };
type Row = Status & { fresh?: boolean };
type Meaning = "isFinished" | "isCancelled" | "isPostponed" | "notifyReview";

/**
 * Settings → Statuses: rows open one at a time to rename (both languages), recolour (the ring
 * glides) and set what a status means with switches. Delete asks inline, then offers Undo.
 */
export function StatusesSection({ statuses, locale, t, errors }: { statuses: Status[]; locale: Locale; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const s = t.statuses;
  const shown = (x: Status) => localName(x.name, x.nameEn, locale);
  const [rows, setRows] = useState<Row[]>(statuses);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", nameEn: "" });
  const [, startTransition] = useTransition();
  const undo = useUndoToast();
  // One message area for everything (errors too), so two messages never sit on top of each other.
  const show = (text: string) => undo.show(text, t.undo);
  const fail = (key: ErrorKey) => show(errors[key] ?? errors.generic);

  /** Shows a change at once and saves it; puts it back if saving fails. */
  const change = (id: string, patch: Partial<Status>, save: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>) => {
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
  // A status means one thing: finished, cancelled or postponed ("Sends review" goes with any).
  const setMeaning = (row: Row, key: Meaning, on: boolean) => {
    const patch: Partial<Status> =
      key === "notifyReview" ? { notifyReview: on } : on ? { isFinished: key === "isFinished", isCancelled: key === "isCancelled", isPostponed: key === "isPostponed" } : { [key]: false };
    const save = { isFinished: setStatusFinished, isCancelled: setStatusCancelled, isPostponed: setStatusPostponed, notifyReview: setStatusReview }[key];
    change(row.id, patch, () => save(row.id, on));
  };

  const add = () => {
    if (!draft.name.trim()) return;
    startTransition(async () => {
      const result = await addStatus(draft.name, draft.nameEn);
      if (!result.ok) return fail(result.error);
      const row: Row = { id: result.id!, name: result.name!, nameEn: result.nameEn ?? null, color: result.color!, isFinished: false, isCancelled: false, isPostponed: false, notifyReview: false, fresh: true };
      setRows((list) => [...list, row]);
      setDraft({ name: "", nameEn: "" });
      undo.show(fill(t.addedToast, { name: shown(row) }), t.undo);
    });
  };

  const remove = (row: Row, el: HTMLElement | null) =>
    startTransition(async () => {
      const index = rows.findIndex((r) => r.id === row.id);
      const result = await deleteStatus(row.id);
      if (!result.ok) return fail(result.error);
      shrinkOut(el, () => {
        setRows((list) => list.filter((r) => r.id !== row.id));
        setOpenId(null);
      });
      undo.show(fill(t.deletedToast, { name: shown(row) }), t.undo, () =>
        startTransition(async () => {
          const back = await restoreStatus(row.id, index);
          if (!back.ok) return fail(back.error);
          setRows((list) => {
            const next = list.filter((r) => r.id !== row.id);
            next.splice(Math.min(index, next.length), 0, { ...row, fresh: true });
            return next;
          });
        }),
      );
    });

  const reorder = (ids: string[]) => {
    const before = rows;
    setRows((list) => ids.map((id) => list.find((r) => r.id === id)!).filter(Boolean));
    startTransition(async () => {
      const result = await reorderStatuses(ids);
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  const colorNames = COLOR_NAMES.map((k) => s.colors[k]);
  return (
    <section aria-label={t.sections.statuses} className={card}>
      <SectionTop title={t.sections.statuses} intro={s.shortIntro} add={<AddButton label={s.add} open={adding} onClick={() => setAdding((v) => !v)} />} />
      <AddForm open={adding} onSubmit={add}>
        <input className={`${inputCls} flex-[1_1_200px]`} aria-label={s.placeholder} placeholder={s.placeholder} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
        <input className={`${inputCls} flex-[1_1_180px]`} aria-label={t.nameEnPlaceholder} placeholder={t.nameEnPlaceholder} value={draft.nameEn} maxLength={60} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} autoComplete="off" />
        <FormButtons cancel={t.cancel} submit={s.add} onCancel={() => setAdding(false)} disabled={!draft.name.trim()} />
      </AddForm>

      <SortableList items={rows} onReorder={reorder}>
        {(row, index, handle) => (
          <SettingsRow
            id={row.id}
            fresh={row.fresh}
            open={openId === row.id}
            onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
            openLabel={fill(t.open, { name: shown(row) })}
            lead={
              <>
                {handle(fill(t.reorder, { name: shown(row) }))}
                <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full shadow-[0_0_0_4px_var(--color-surface)] transition-colors duration-300" style={{ background: row.color }} />
              </>
            }
            title={row.name}
            subtitle={row.nameEn || "—"}
            badges={
              <>
                {index === 0 && <Badge tone="teal">{s.startsHere}</Badge>}
                {row.isFinished && <Badge tone="green">{s.badgeFinished}</Badge>}
                {row.notifyReview && <Badge tone="sun">{s.badgeReview}</Badge>}
                {row.isCancelled && <Badge tone="grey">{s.badgeCancelled}</Badge>}
                {row.isPostponed && <Badge tone="grey">{s.badgePostponed}</Badge>}
              </>
            }
          >
            <Line label={t.nameLabel}>
              <Lang tag="AZ">
                <SavedInput value={row.name} label={s.placeholder} required onSave={(name) => change(row.id, { name }, () => renameStatus(row.id, name))} />
              </Lang>
              <Lang tag="EN">
                <SavedInput value={row.nameEn ?? ""} label={fill(t.nameEnOf, { name: row.name })} placeholder={t.nameEnPlaceholder} onSave={(nameEn) => change(row.id, { nameEn: nameEn || null }, () => renameStatusEn(row.id, nameEn))} />
              </Lang>
            </Line>
            <Line label={t.colour}>
              <ColorSwatches colors={STATUS_COLORS} value={row.color} label={fill(s.colorOf, { name: shown(row) })} names={colorNames} onChange={(color) => change(row.id, { color }, () => setStatusColor(row.id, color))} />
            </Line>
            <Line label={t.meaning}>
              <span className="flex flex-wrap gap-x-6">
                <Switch label={s.finished} checked={row.isFinished} onChange={(on) => setMeaning(row, "isFinished", on)} />
                <Switch label={s.review} checked={row.notifyReview} onChange={(on) => setMeaning(row, "notifyReview", on)} />
                <Switch label={s.cancelled} checked={row.isCancelled} onChange={(on) => setMeaning(row, "isCancelled", on)} />
                <Switch label={s.postponed} checked={row.isPostponed} onChange={(on) => setMeaning(row, "isPostponed", on)} />
              </span>
            </Line>
            <RowFoot label={t.delete} confirm={fill(s.confirmDelete, { name: shown(row) })} cancelLabel={t.cancel} onDo={(el) => remove(row, el)} />
          </SettingsRow>
        )}
      </SortableList>
      <UndoToast offer={undo.offer} onClose={undo.close} />
    </section>
  );
}
