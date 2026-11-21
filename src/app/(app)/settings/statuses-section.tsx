"use client";

import { startTransition, useOptimistic, useState } from "react";
import { InlineText } from "@/components/inline-text";
import { SortableList } from "@/components/sortable-list";
import { Toast, useToast } from "@/components/toast";
import { btn, card, row } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { COLOR_NAMES, STATUS_COLORS } from "@/lib/settings-rules";
import { addStatus, deleteStatus, renameStatus, reorderStatuses, setStatusColor, setStatusFinished } from "./actions";
import { AddNameForm } from "./add-name-form";
import { ConfirmBar } from "@/components/confirm-bar";
import { SectionHeader } from "./section-header";
import { useAction } from "./use-action";

type Status = { id: string; name: string; color: string; isFinished: boolean };

export function StatusesSection({ statuses, t, errors }: { statuses: Status[]; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
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
      <SectionHeader title={t.sections.statuses} intro={`${s.intro} ${t.dragHint}`} />
      <SortableList items={ordered} onReorder={reorder}>
        {(status, index, handle) => (
          <div data-row className={`flex flex-col gap-2.5 ${row}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {handle(fill(t.reorder, { name: status.name }))}
              <button
                type="button"
                aria-label={fill(s.colorOf, { name: status.name })}
                aria-expanded={colorOpen === status.id}
                onClick={() => setColorOpen(colorOpen === status.id ? null : status.id)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white"
              >
                <span className="size-4 rounded-full" style={{ background: status.color }} />
              </button>
              <div className="min-w-0 flex-[1_1_160px]">
                <InlineText value={status.name} label={s.placeholder} onSave={(name) => run(() => renameStatus(status.id, name))} />
              </div>
              {index === 0 && (
                <span className="whitespace-nowrap rounded-full bg-teal-tint px-2.5 py-1 text-xs font-semibold text-teal-deep">{s.startsHere}</span>
              )}
              <label className="flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-teal"
                  checked={status.isFinished}
                  disabled={pending}
                  onChange={(e) => run(() => setStatusFinished(status.id, e.target.checked))}
                />
                {s.finished}
              </label>
              <button type="button" className={btn.soft} onClick={() => setConfirming(status.id)}>
                {t.delete}
              </button>
            </div>
            {colorOpen === status.id && (
              <div role="group" aria-label={fill(s.colorOf, { name: status.name })} className="flex flex-wrap gap-2 pl-[52px]">
                {STATUS_COLORS.map((color, i) => (
                  <button
                    key={color}
                    type="button"
                    aria-pressed={status.color === color}
                    onClick={() => run(() => setStatusColor(status.id, color), () => setColorOpen(null))}
                    className={`flex min-h-10 items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold ${status.color === color ? "ring-2 ring-teal" : ""}`}
                  >
                    <span className="size-3.5 rounded-full" style={{ background: color }} />
                    {s.colors[COLOR_NAMES[i]]}
                  </button>
                ))}
              </div>
            )}
            {confirming === status.id && (
              <ConfirmBar
                text={fill(s.confirmDelete, { name: status.name })}
                confirmLabel={t.delete}
                cancelLabel={t.cancel}
                disabled={pending}
                onCancel={() => setConfirming(null)}
                onConfirm={() =>
                  run(
                    () => deleteStatus(status.id),
                    () => {
                      setConfirming(null);
                      show(fill(s.deleted, { name: status.name }));
                    },
                  )
                }
              />
            )}
          </div>
        )}
      </SortableList>
      <AddNameForm label={s.placeholder} buttonLabel={s.add} disabled={pending} onAdd={(name, reset) => run(() => addStatus(name), reset)} />
      <Toast message={message} />
    </section>
  );
}
