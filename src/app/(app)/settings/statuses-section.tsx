"use client";

import { startTransition, useOptimistic, useState } from "react";
import { SortableList } from "@/components/sortable-list";
import { Toast, useToast } from "@/components/toast";
import { btn, card, row } from "@/components/ui";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { localName } from "@/lib/names";
import { COLOR_NAMES, STATUS_COLORS } from "@/lib/settings-rules";
import { addStatus, deleteStatus, renameStatus, renameStatusEn, reorderStatuses, setStatusColor, setStatusFinished, setStatusReview } from "./actions";
import { BilingualName } from "./bilingual-name";
import { AddNameForm } from "./add-name-form";
import { ConfirmBar } from "@/components/confirm-bar";
import { SectionHeader } from "./section-header";
import { useAction } from "./use-action";

type Status = { id: string; name: string; nameEn: string | null; color: string; isFinished: boolean; notifyReview: boolean };

export function StatusesSection({ statuses, locale, t, errors }: { statuses: Status[]; locale: Locale; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const shown = (x: Status) => localName(x.name, x.nameEn, locale);
  const { message, show } = useToast();
  const { pending, run } = useAction(errors, show);
  const [ordered, setOrdered] = useOptimistic(statuses, (current, ids: string[]) =>
    ids.map((id) => current.find((s) => s.id === id)).filter((s): s is Status => !!s),
  );
  const [colorOpen, setColorOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const s = t.statuses;

  function reorder(ids: string[]) {
    startTransition(async () => {
      setOrdered(ids);
      const result = await reorderStatuses(ids);
      if (!result.ok) show(errors[result.error], "error");
    });
  }

  return (
    <section aria-label={t.sections.statuses} className={card}>
      <SectionHeader title={t.sections.statuses} intro={`${s.intro} ${t.dragHint} ${t.namesHint}`} />
      <SortableList items={ordered} onReorder={reorder}>
        {(status, index, handle) => (
          <div data-row className={`flex flex-col gap-2.5 ${row}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {handle(fill(t.reorder, { name: shown(status) }))}
              <button
                type="button"
                aria-label={fill(s.colorOf, { name: shown(status) })}
                aria-expanded={colorOpen === status.id}
                onClick={() => setColorOpen(colorOpen === status.id ? null : status.id)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface"
              >
                <span className="size-4 rounded-full" style={{ background: status.color }} />
              </button>
              <div className="min-w-0 flex-[1_1_160px]">
                <BilingualName
                  name={status.name}
                  nameEn={status.nameEn}
                  label={s.placeholder}
                  labelEn={fill(t.nameEnOf, { name: status.name })}
                  placeholderEn={t.nameEnPlaceholder}
                  onSave={(name) => run(() => renameStatus(status.id, name))}
                  onSaveEn={(nameEn) => run(() => renameStatusEn(status.id, nameEn))}
                />
              </div>
              {index === 0 && (
                <span className="whitespace-nowrap rounded-full bg-teal-tint px-2.5 py-1 text-xs font-semibold text-teal-deep">{s.startsHere}</span>
              )}
              <button type="button" className={btn.soft} onClick={() => setConfirming(status.id)}>
                {t.delete}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pl-1 sm:pl-[104px]">
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  className="size-[18px] accent-teal"
                  checked={status.isFinished}
                  disabled={pending}
                  onChange={(e) => run(() => setStatusFinished(status.id, e.target.checked))}
                />
                {s.finished}
              </label>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  className="size-[18px] accent-teal"
                  checked={status.notifyReview}
                  disabled={pending}
                  onChange={(e) => run(() => setStatusReview(status.id, e.target.checked))}
                />
                {s.review}
              </label>
            </div>
            {colorOpen === status.id && (
              <div role="group" aria-label={fill(s.colorOf, { name: shown(status) })} className="flex flex-wrap gap-2 pl-[52px]">
                {STATUS_COLORS.map((color, i) => (
                  <button
                    key={color}
                    type="button"
                    aria-pressed={status.color === color}
                    onClick={() => run(() => setStatusColor(status.id, color), () => setColorOpen(null))}
                    className={`flex min-h-10 items-center gap-2 rounded-full bg-surface px-3 text-[13px] font-semibold ${status.color === color ? "ring-2 ring-teal" : ""}`}
                  >
                    <span className="size-3.5 rounded-full" style={{ background: color }} />
                    {s.colors[COLOR_NAMES[i]]}
                  </button>
                ))}
              </div>
            )}
            {confirming === status.id && (
              <ConfirmBar
                text={fill(s.confirmDelete, { name: shown(status) })}
                confirmLabel={t.delete}
                cancelLabel={t.cancel}
                disabled={pending}
                onCancel={() => setConfirming(null)}
                onConfirm={() =>
                  run(
                    () => deleteStatus(status.id),
                    () => {
                      setConfirming(null);
                      show(fill(s.deleted, { name: shown(status) }));
                    },
                  )
                }
              />
            )}
          </div>
        )}
      </SortableList>
      <AddNameForm label={s.placeholder} labelEn={t.nameEnPlaceholder} buttonLabel={s.add} disabled={pending} onAdd={(name, reset, nameEn) => run(() => addStatus(name, nameEn), reset)} />
      <Toast message={message} />
    </section>
  );
}
