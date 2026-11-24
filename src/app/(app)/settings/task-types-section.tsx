"use client";

import { useState, useTransition } from "react";
import { shrinkOut, UndoToast, useUndoToast } from "@/components/list-motion";
import { SortableList } from "@/components/sortable-list";
import { card } from "@/components/ui";
import type { Dictionary, ErrorKey, Locale } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { localName } from "@/lib/names";
import { DEFAULT_TASK_ICON, isTaskIcon, type TaskIcon } from "@/lib/task-icons";
import { addTaskType, deleteTaskType, renameTaskType, renameTaskTypeEn, reorderTaskTypes, restoreTaskType, setTaskTypeIcon } from "./actions";
import { AddButton, AddForm, Badge, FormButtons, IconPicker, inputCls, Lang, Line, RowFoot, SavedInput, SectionTop, SettingsRow } from "./settings-ui";

type TaskType = { id: string; name: string; nameEn: string | null; isPublishing: boolean; icon: string };
type Row = TaskType & { fresh?: boolean };

/**
 * Settings → Task types: each with an icon (tap it to pick another; saved at once), names in both
 * languages, drag to reorder. "Post publishing" (used by the month planner) can't be deleted.
 */
export function TaskTypesSection({ types, locale, t, errors }: { types: TaskType[]; locale: Locale; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const k = t.types;
  const shown = (x: TaskType) => localName(x.name, x.nameEn, locale);
  const [rows, setRows] = useState<Row[]>(types);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; nameEn: string; icon: TaskIcon }>({ name: "", nameEn: "", icon: DEFAULT_TASK_ICON });
  const [, startTransition] = useTransition();
  const undo = useUndoToast();
  // One message area for everything (errors too), so two messages never sit on top of each other.
  const show = (text: string) => undo.show(text, t.undo);
  const fail = (key: ErrorKey) => show(errors[key] ?? errors.generic);
  const iconOf = (x: TaskType): TaskIcon => (isTaskIcon(x.icon) ? x.icon : DEFAULT_TASK_ICON);

  const change = (id: string, patch: Partial<TaskType>, save: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>) => {
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

  const add = () => {
    if (!draft.name.trim()) return;
    startTransition(async () => {
      const result = await addTaskType(draft.name, draft.nameEn, draft.icon);
      if (!result.ok || !result.id) return fail(result.ok ? "generic" : result.error);
      const row: Row = { id: result.id, name: draft.name.trim(), nameEn: draft.nameEn.trim() || null, isPublishing: false, icon: draft.icon, fresh: true };
      setRows((list) => [...list, row]);
      setDraft({ name: "", nameEn: "", icon: DEFAULT_TASK_ICON });
      undo.show(fill(t.addedToast, { name: shown(row) }), t.undo);
    });
  };

  const remove = (row: Row, el: HTMLElement | null) =>
    startTransition(async () => {
      const index = rows.findIndex((r) => r.id === row.id);
      const result = await deleteTaskType(row.id);
      if (!result.ok) return fail(result.error);
      shrinkOut(el, () => {
        setRows((list) => list.filter((r) => r.id !== row.id));
        setOpenId(null);
      });
      undo.show(fill(t.deletedToast, { name: shown(row) }), t.undo, () =>
        startTransition(async () => {
          const back = await restoreTaskType(row.id, index);
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
      const result = await reorderTaskTypes(ids);
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  return (
    <section aria-label={t.sections.types} className={card}>
      <SectionTop title={t.sections.types} intro={k.shortIntro} add={<AddButton label={k.add} open={adding} onClick={() => setAdding((v) => !v)} />} />
      <AddForm open={adding} onSubmit={add}>
        <IconPicker value={draft.icon} label={fill(t.iconOf, { name: draft.name.trim() || k.placeholder })} title={t.chooseIcon} names={t.iconNames} onChange={(icon) => setDraft({ ...draft, icon })} />
        <input className={`${inputCls} flex-[1_1_200px]`} aria-label={k.placeholder} placeholder={k.placeholder} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
        <input className={`${inputCls} flex-[1_1_180px]`} aria-label={t.nameEnPlaceholder} placeholder={t.nameEnPlaceholder} value={draft.nameEn} maxLength={60} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} autoComplete="off" />
        <FormButtons cancel={t.cancel} submit={k.add} onCancel={() => setAdding(false)} disabled={!draft.name.trim()} />
      </AddForm>

      <SortableList items={rows} onReorder={reorder}>
        {(row, _i, handle) => (
          <SettingsRow
            id={row.id}
            fresh={row.fresh}
            open={openId === row.id}
            onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
            openLabel={fill(t.open, { name: shown(row) })}
            lead={
              <>
                {handle(fill(t.reorder, { name: shown(row) }))}
                <IconPicker value={iconOf(row)} label={fill(t.iconOf, { name: shown(row) })} title={t.chooseIcon} names={t.iconNames} onChange={(icon) => change(row.id, { icon }, () => setTaskTypeIcon(row.id, icon))} />
              </>
            }
            title={row.name}
            subtitle={row.nameEn || "—"}
            badges={row.isPublishing ? <Badge tone="grey">{k.publishingBadge}</Badge> : undefined}
          >
            <Line label={t.nameLabel}>
              <Lang tag="AZ">
                <SavedInput value={row.name} label={k.placeholder} required onSave={(name) => change(row.id, { name }, () => renameTaskType(row.id, name))} />
              </Lang>
              <Lang tag="EN">
                <SavedInput value={row.nameEn ?? ""} label={fill(t.nameEnOf, { name: row.name })} placeholder={t.nameEnPlaceholder} onSave={(nameEn) => change(row.id, { nameEn: nameEn || null }, () => renameTaskTypeEn(row.id, nameEn))} />
              </Lang>
            </Line>
            {row.isPublishing ? (
              <RowFoot note={k.publishingNote} cancelLabel={t.cancel} />
            ) : (
              <RowFoot label={t.delete} confirm={fill(k.confirmDelete, { name: shown(row) })} cancelLabel={t.cancel} onDo={(el) => remove(row, el)} />
            )}
          </SettingsRow>
        )}
      </SortableList>
      <UndoToast offer={undo.offer} onClose={undo.close} />
    </section>
  );
}
