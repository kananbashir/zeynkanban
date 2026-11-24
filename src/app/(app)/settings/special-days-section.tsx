"use client";

import { useRef, useState, useTransition } from "react";
import { shrinkOut, UndoToast, useUndoToast } from "@/components/list-motion";
import { SegmentedControl } from "@/components/motion";
import { Switch } from "@/components/switch";
import { card } from "@/components/ui";
import type { DayKind } from "@/db/schema";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { daysBetween } from "@/lib/dates";
import { addSpecialDay, deleteSpecialDay, updateSpecialDay } from "./actions";
import { AddButton, AddForm, Badge, FormButtons, Group, inputCls, Lang, Line, RowFoot, SavedInput, SectionTop, SettingsRow, useFresh, useGlide } from "./settings-ui";

type Day = { id: string; date: string; name: string; nameEn: string | null; kind: DayKind; yearly: boolean };

const REPEAT = "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3";

/**
 * Settings → Holidays and special events: a date tile, Holiday or Event, a mark for yearly days and
 * "In N days". Upcoming days first, by date; past ones fold away under "Earlier".
 */
export function SpecialDaysSection({ days, today, t, errors }: { days: Day[]; today: string; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const d = t.days;
  const [rows, setRows] = useState(days);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: today, name: "", nameEn: "", kind: "holiday" as DayKind, yearly: true });
  const [, startTransition] = useTransition();
  const undo = useUndoToast();
  // One message area for everything (errors too), so two messages never sit on top of each other.
  const show = (text: string) => undo.show(text, t.undo);
  const { isFresh, mark } = useFresh();
  const box = useRef<HTMLDivElement>(null);
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const glide = useGlide(box, sorted.map((r) => r.id).join());
  const fail = (key: ErrorKey) => show(errors[key] ?? errors.generic);
  const kinds = [
    { key: "holiday", label: d.holiday },
    { key: "event", label: d.eventShort },
  ];

  const change = (id: string, patch: Partial<Day>) => {
    const before = rows;
    if (patch.date) glide.capture();
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(async () => {
      const result = await updateSpecialDay(id, patch);
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  const add = () =>
    startTransition(async () => {
      const result = await addSpecialDay(draft);
      if (!result.ok || !result.id) return fail(result.ok ? "generic" : result.error);
      glide.capture();
      setRows((list) => [...list, { id: result.id!, date: draft.date, name: result.name!, nameEn: result.nameEn ?? null, kind: draft.kind, yearly: draft.yearly }]);
      mark(result.id);
      setDraft({ ...draft, name: "", nameEn: "" });
      undo.show(fill(d.placedToast, { name: result.name! }), t.undo);
    });

  const remove = (row: Day, el: HTMLElement | null) =>
    startTransition(async () => {
      const result = await deleteSpecialDay(row.id);
      if (!result.ok) return fail(result.error);
      shrinkOut(el, () => {
        setOpenId(null);
        setRows((list) => list.filter((r) => r.id !== row.id));
      });
      undo.show(fill(d.removedToast, { name: row.name }), t.undo, () =>
        startTransition(async () => {
          const back = await addSpecialDay(row);
          if (!back.ok) return fail(back.error);
          glide.capture();
          setRows((list) => [...list.filter((r) => r.id !== row.id), row]);
          mark(row.id);
        }),
      );
    });

  const until = (date: string) => {
    const n = daysBetween(today, date);
    return n === 0 ? d.today : n === 1 ? d.tomorrow : n > 1 ? fill(d.inDays, { n }) : "";
  };

  const rowOf = (row: Day) => (
    <SettingsRow
      key={row.id}
      id={row.id}
      fresh={isFresh(row.id)}
      open={openId === row.id}
      onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
      openLabel={fill(t.open, { name: row.name })}
      lead={
        <span aria-hidden="true" className="flex h-14 w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-surface leading-none">
          <b className="text-[19px] font-bold">{Number(row.date.slice(8))}</b>
          <small className={`mt-[3px] text-[10.5px] font-extrabold tracking-wide ${row.kind === "event" ? "text-event" : "text-teal-deep"}`}>{d.monthsShort[Number(row.date.slice(5, 7)) - 1]}</small>
        </span>
      }
      title={row.name}
      subtitle={row.nameEn || "—"}
      badges={
        <>
          <Badge tone={row.kind === "event" ? "sun" : "teal"}>{row.kind === "event" ? `★ ${d.eventShort}` : `⚑ ${d.holiday}`}</Badge>
          {row.yearly && (
            <span title={d.yearly} aria-label={d.yearly} className="flex text-muted">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={REPEAT} />
              </svg>
            </span>
          )}
          {until(row.date) && <span className="whitespace-nowrap text-xs text-muted">{until(row.date)}</span>}
        </>
      }
    >
      <Line label={d.date}>
        <SavedInput type="date" value={row.date} label={d.date} required onSave={(date) => change(row.id, { date })} />
        <Switch label={d.yearly} checked={row.yearly} onChange={(yearly) => change(row.id, { yearly })} />
      </Line>
      <Line label={t.nameLabel}>
        <Lang tag="AZ">
          <SavedInput value={row.name} label={d.name} required onSave={(name) => change(row.id, { name })} />
        </Lang>
        <Lang tag="EN">
          <SavedInput value={row.nameEn ?? ""} label={fill(t.nameEnOf, { name: row.name })} placeholder={t.nameEnPlaceholder} onSave={(nameEn) => change(row.id, { nameEn: nameEn || null })} />
        </Lang>
      </Line>
      <Line label={d.kind}>
        <SegmentedControl label={d.kind} items={kinds} value={row.kind} onChange={(kind) => change(row.id, { kind: kind as DayKind })} tone="teal" itemClassName="min-h-9 px-3.5 text-[13px]" />
      </Line>
      <RowFoot label={d.remove} confirm={fill(d.confirmRemove, { name: row.name })} cancelLabel={t.cancel} onDo={(el) => remove(row, el)} />
    </SettingsRow>
  );

  const upcoming = sorted.filter((r) => r.date >= today);
  const past = sorted.filter((r) => r.date < today);
  return (
    <section aria-label={t.sections.days} className={card}>
      <SectionTop title={t.sections.days} intro={d.shortIntro} add={<AddButton label={d.add} open={adding} onClick={() => setAdding((v) => !v)} />} />
      <AddForm open={adding} onSubmit={add}>
        <input type="date" aria-label={d.date} className={`${inputCls} w-auto flex-[0_1_170px]`} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <input className={`${inputCls} flex-[1_1_180px]`} aria-label={d.name} placeholder={d.name} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
        <input className={`${inputCls} flex-[1_1_160px]`} aria-label={t.nameEnPlaceholder} placeholder={t.nameEnPlaceholder} value={draft.nameEn} maxLength={60} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} autoComplete="off" />
        <SegmentedControl label={d.kind} items={kinds} value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind: kind as DayKind })} tone="teal" itemClassName="min-h-9 px-3.5 text-[13px]" />
        <Switch label={d.yearly} checked={draft.yearly} onChange={(yearly) => setDraft({ ...draft, yearly })} />
        <FormButtons cancel={t.cancel} submit={d.add} onCancel={() => setAdding(false)} disabled={!draft.name.trim() || !draft.date} />
      </AddForm>
      <div ref={box} className="flex flex-col gap-2.5">
        {rows.length === 0 && <p className="py-4 text-sm text-muted">{d.empty}</p>}
        <div className="flex flex-col gap-2.5 empty:hidden">{upcoming.map(rowOf)}</div>
        <Group label={fill(d.past, { n: past.length })} count={past.length}>
          {past.map(rowOf)}
        </Group>
      </div>
      <UndoToast offer={undo.offer} onClose={undo.close} />
    </section>
  );
}
