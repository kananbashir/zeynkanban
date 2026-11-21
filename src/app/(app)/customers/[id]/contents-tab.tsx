"use client";

import { useMemo, useState, useTransition } from "react";
import { InlineText } from "@/components/inline-text";
import { Toast, useToast } from "@/components/toast";
import { btn, card, field, row, rowOff } from "@/components/ui";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { suggestContentId } from "@/lib/content-rules";
import { addContent, renameContent, setContentArchived } from "../actions";

type Period = { id: string; label: string; code: string };
type Content = { id: string; code: string; archived: boolean; contentTypeId: string; typeName: string; typeCode: string; contractId: string | null };
type ContentType = { id: string; code: string; name: string };

export function ContentsTab({
  customerId,
  shortName,
  periods,
  contents,
  types,
  canArchive,
  t,
  errors,
}: {
  customerId: string;
  shortName: string;
  periods: Period[];
  contents: Content[];
  types: ContentType[];
  canArchive: boolean;
  t: Dictionary["customers"]["contents"];
  errors: Dictionary["errors"];
}) {
  const { message, show } = useToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [contractId, setContractId] = useState(periods[0]?.id ?? "");
  const [typed, setTyped] = useState<string | null>(null); // null = use the suggestion
  const [formError, setFormError] = useState<string | null>(null);
  // IDs saved from this form, counted for the next suggestion even before the page has refreshed.
  const [justAdded, setJustAdded] = useState<string[]>([]);

  const periodById = useMemo(() => new Map(periods.map((p) => [p.id, p])), [periods]);
  const type = types.find((x) => x.id === typeId);
  const period = periodById.get(contractId);
  const suggestion = type && period ? suggestContentId(shortName, type.code, period.code, [...contents.map((x) => x.code), ...justAdded]) : "";
  const code = typed ?? suggestion;

  const active = contents.filter((x) => !x.archived && (filter === "all" || x.contentTypeId === filter));
  const archived = contents.filter((x) => x.archived);
  // Types that exist on this customer's content but are archived in Settings still get a filter chip.
  const filterTypes = [...types, ...contents.filter((x) => !types.some((t2) => t2.id === x.contentTypeId)).map((x) => ({ id: x.contentTypeId, code: x.typeCode, name: x.typeName }))].filter(
    (x, i, all) => all.findIndex((y) => y.id === x.id) === i,
  );

  function run(action: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>, onOk?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) onOk?.();
        else show(errors[result.error], "error");
      } catch {
        show(errors.generic, "error");
      }
    });
  }

  const seg = (on: boolean) => (on ? "bg-white text-ink shadow-[0_1px_3px_rgba(24,35,47,0.14)]" : "text-ink-soft");

  const contentRow = (item: Content) => (
    <div key={item.id} data-row className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 ${item.archived ? rowOff : row}`}>
      <div className="min-w-0 flex-[1_1_240px]">
        {item.archived ? (
          <span className="px-2.5 font-mono text-[13px] font-medium">{item.code}</span>
        ) : (
          <InlineText mono value={item.code} label={t.editId} onSave={(next) => run(() => renameContent(item.id, next))} />
        )}
      </div>
      <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold">{item.typeName}</span>
      <span className="whitespace-nowrap text-[13px] text-ink-soft">{item.contractId ? periodById.get(item.contractId)?.label : ""}</span>
      <span className="whitespace-nowrap text-[13px] text-muted">{t.noTasks}</span>
      {canArchive && (
        <button type="button" className={`${btn.soft} ml-auto`} disabled={pending} onClick={() => run(() => setContentArchived(item.id, !item.archived))}>
          {item.archived ? t.restore : t.archive}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <section aria-label={t.addTitle} className={card}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label={t.type} className="flex flex-wrap gap-1 rounded-full bg-mint p-1">
            {[{ id: "all", name: t.all }, ...filterTypes].map((x) => (
              <button key={x.id} type="button" aria-pressed={filter === x.id} onClick={() => setFilter(x.id)} className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${seg(filter === x.id)}`}>
                {x.name}
              </button>
            ))}
          </div>
          <button type="button" className={`${btn.primary} ml-auto`} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            {t.add}
          </button>
        </div>

        {adding && (
          <form
            className="flex flex-col gap-4 rounded-[22px] bg-mint p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              startTransition(async () => {
                const result = await addContent(customerId, typeId, contractId, code);
                if (!result.ok) return setFormError(errors[result.error]);
                show(fill(t.saved, { code }));
                setJustAdded((list) => [...list, code]);
                setTyped(null);
              });
            }}
          >
            <h3 className="text-base font-semibold">{t.addTitle}</h3>
            {periods.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.needContract}</p>
            ) : types.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noTypes}</p>
            ) : (
              <>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {t.type}
                    <select className={field} value={typeId} onChange={(e) => (setTypeId(e.target.value), setTyped(null))}>
                      {types.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} ({x.code})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    {t.period}
                    <select className={field} value={contractId} onChange={(e) => (setContractId(e.target.value), setTyped(null))}>
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.code})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  {t.id}
                  <input
                    className={`${field} font-mono text-sm`}
                    value={code}
                    onChange={(e) => setTyped(e.target.value.toLowerCase())}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={60}
                  />
                </label>
                <p className={`text-[13px] ${formError ? "font-medium text-danger" : "text-ink-soft"}`} role={formError ? "alert" : undefined}>
                  {formError ?? t.suggestHelp}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button type="submit" className={btn.primary} disabled={pending || !code}>
                    {t.save}
                  </button>
                  <button type="button" className={btn.soft} onClick={() => setAdding(false)}>
                    {t.cancel}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        <div className="flex flex-col gap-2.5">
          {active.map(contentRow)}
          {active.length === 0 && <p className="py-5 text-center text-sm text-muted">{filter === "all" ? t.empty : t.emptyType}</p>}
        </div>
      </section>

      {archived.length > 0 && (
        <section aria-label={t.archivedTitle} className={card}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="flex-1 text-base font-semibold">{t.archivedTitle}</h3>
            <span className="text-[13px] text-muted">{t.archivedHelp}</span>
          </div>
          <div className="flex flex-col gap-2.5">{archived.map(contentRow)}</div>
        </section>
      )}
      <Toast message={message} />
    </div>
  );
}
