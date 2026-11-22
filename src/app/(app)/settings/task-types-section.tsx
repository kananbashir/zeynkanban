"use client";

import { startTransition, useOptimistic, useState } from "react";
import { SortableList } from "@/components/sortable-list";
import { Toast, useToast } from "@/components/toast";
import { btn, card, row } from "@/components/ui";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { localName } from "@/lib/names";
import { addTaskType, deleteTaskType, renameTaskType, renameTaskTypeEn, reorderTaskTypes } from "./actions";
import { AddNameForm } from "./add-name-form";
import { BilingualName } from "./bilingual-name";
import { ConfirmBar } from "@/components/confirm-bar";
import { SectionHeader } from "./section-header";
import { useAction } from "./use-action";

type TaskType = { id: string; name: string; nameEn: string | null; isPublishing: boolean };

export function TaskTypesSection({ types, locale, t, errors }: { types: TaskType[]; locale: Locale; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const shown = (x: TaskType) => localName(x.name, x.nameEn, locale);
  const { message, show } = useToast();
  const { pending, run } = useAction(errors, show);
  const [ordered, setOrdered] = useOptimistic(types, (current, ids: string[]) =>
    ids.map((id) => current.find((x) => x.id === id)).filter((x): x is TaskType => !!x),
  );
  const [confirming, setConfirming] = useState<string | null>(null);
  const k = t.types;

  function reorder(ids: string[]) {
    startTransition(async () => {
      setOrdered(ids);
      const result = await reorderTaskTypes(ids);
      if (!result.ok) show(errors[result.error], "error");
    });
  }

  return (
    <section aria-label={t.sections.types} className={card}>
      <SectionHeader title={t.sections.types} intro={`${k.intro} ${t.dragHint} ${t.namesHint}`} />
      <SortableList items={ordered} onReorder={reorder}>
        {(type, _index, handle) => (
          <div data-row className={`flex flex-col gap-2.5 ${row}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {handle(fill(t.reorder, { name: shown(type) }))}
              <div className="min-w-0 flex-[1_1_200px]">
                <BilingualName
                  name={type.name}
                  nameEn={type.nameEn}
                  label={k.placeholder}
                  labelEn={fill(t.nameEnOf, { name: type.name })}
                  placeholderEn={t.nameEnPlaceholder}
                  onSave={(name) => run(() => renameTaskType(type.id, name))}
                  onSaveEn={(nameEn) => run(() => renameTaskTypeEn(type.id, nameEn))}
                />
              </div>
              {type.isPublishing ? (
                <span title={errors.publishingType} className="rounded-full bg-teal-tint px-2.5 py-1 text-xs font-semibold text-teal-deep">
                  {k.publishing}
                </span>
              ) : (
                <button type="button" className={btn.soft} onClick={() => setConfirming(type.id)}>
                  {t.delete}
                </button>
              )}
            </div>
            {confirming === type.id && (
              <ConfirmBar
                text={fill(k.confirmDelete, { name: shown(type) })}
                confirmLabel={t.delete}
                cancelLabel={t.cancel}
                disabled={pending}
                onCancel={() => setConfirming(null)}
                onConfirm={() =>
                  run(
                    () => deleteTaskType(type.id),
                    () => {
                      setConfirming(null);
                      show(fill(k.deleted, { name: shown(type) }));
                    },
                  )
                }
              />
            )}
          </div>
        )}
      </SortableList>
      <AddNameForm label={k.placeholder} labelEn={t.nameEnPlaceholder} buttonLabel={k.add} disabled={pending} onAdd={(name, reset, nameEn) => run(() => addTaskType(name, nameEn), reset)} />
      <Toast message={message} />
    </section>
  );
}
