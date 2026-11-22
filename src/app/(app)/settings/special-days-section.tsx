"use client";

import { useState } from "react";
import { Toast, useToast } from "@/components/toast";
import { btn, card, field, fieldSmall, row } from "@/components/ui";
import type { DayKind } from "@/db/schema";
import { fill } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import { addSpecialDay, deleteSpecialDay, updateSpecialDay } from "./actions";
import { BilingualName } from "./bilingual-name";
import { SectionHeader } from "./section-header";
import { useAction } from "./use-action";
import { Plus } from "./users-section";

type Day = { id: string; date: string; name: string; nameEn: string | null; kind: DayKind; yearly: boolean };

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SpecialDaysSection({ days, t, errors }: { days: Day[]; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const { message, show } = useToast();
  const { pending, run } = useAction(errors, show);
  const [draft, setDraft] = useState({ date: today(), name: "", nameEn: "", kind: "holiday" as DayKind, yearly: true });
  const d = t.days;

  const kindSelect = (value: DayKind, onChange: (kind: DayKind) => void, className: string) => (
    <select aria-label={d.kind} className={className} value={value} onChange={(e) => onChange(e.target.value as DayKind)}>
      <option value="holiday">{d.holiday}</option>
      <option value="event">{d.event}</option>
    </select>
  );

  return (
    <section aria-label={t.sections.days} className={card}>
      <SectionHeader title={t.sections.days} intro={`${d.intro} ${t.namesHint}`} />

      <form
        className="flex flex-wrap items-center gap-2.5 rounded-[22px] bg-mint p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addSpecialDay(draft), () => setDraft({ ...draft, name: "", nameEn: "" }));
        }}
      >
        <input type="date" aria-label={d.date} className={`${field} w-auto`} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <input className={`${field} flex-[1_1_200px]`} aria-label={d.name} placeholder={d.name} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} autoComplete="off" />
        <input className={`${field} flex-[1_1_180px]`} aria-label={t.nameEnPlaceholder} placeholder={t.nameEnPlaceholder} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} maxLength={60} autoComplete="off" />
        {kindSelect(draft.kind, (kind) => setDraft({ ...draft, kind }), `${field} w-auto`)}
        <label className="flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
          <input type="checkbox" className="size-5 accent-teal" checked={draft.yearly} onChange={(e) => setDraft({ ...draft, yearly: e.target.checked })} />
          {d.yearly}
        </label>
        <button type="submit" className={btn.primary} disabled={pending || !draft.name.trim() || !draft.date}>
          <Plus />
          {d.add}
        </button>
      </form>

      <div className="flex flex-col gap-2.5">
        {days.length === 0 && <p className="py-4 text-sm text-muted">{d.empty}</p>}
        {days.map((day) => (
          <div key={day.id} data-row className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${row}`}>
            <input
              type="date"
              aria-label={d.date}
              className={fieldSmall}
              defaultValue={day.date}
              key={day.date}
              onChange={(e) => e.target.value && e.target.value !== day.date && run(() => updateSpecialDay(day.id, { date: e.target.value }))}
            />
            <div className="min-w-0 flex-[1_1_200px]">
              <BilingualName
                name={day.name}
                nameEn={day.nameEn}
                label={d.name}
                labelEn={fill(t.nameEnOf, { name: day.name })}
                placeholderEn={t.nameEnPlaceholder}
                onSave={(name) => run(() => updateSpecialDay(day.id, { name }))}
                onSaveEn={(nameEn) => run(() => updateSpecialDay(day.id, { nameEn }))}
              />
            </div>
            {kindSelect(day.kind, (kind) => run(() => updateSpecialDay(day.id, { kind })), fieldSmall)}
            <label className="flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
              <input type="checkbox" className="size-5 accent-teal" checked={day.yearly} disabled={pending} onChange={(e) => run(() => updateSpecialDay(day.id, { yearly: e.target.checked }))} />
              {d.yearly}
            </label>
            <button type="button" className={btn.soft} disabled={pending} onClick={() => run(() => deleteSpecialDay(day.id))}>
              {d.remove}
            </button>
          </div>
        ))}
      </div>
      <Toast message={message} />
    </section>
  );
}
