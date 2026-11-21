"use client";

import { useState, useTransition } from "react";
import { MonthPicker, yearsAround } from "@/components/month-picker";
import { Toast, useToast } from "@/components/toast";
import { btn, card } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { defaultRenewal, formatPeriod, parseMonth, periodCode } from "@/lib/content-rules";
import { renewContract, setCustomerArchived } from "../actions";
import { CustomerForm, type CustomerInfo } from "../customer-form";
import { ConfirmBar } from "@/components/confirm-bar";

type Period = { id: string; start: string; end: string; label: string; code: string };

const ym = (m: { year: number; month: number }) => `${m.year}-${String(m.month).padStart(2, "0")}`;

export function InfoTab({
  customerId,
  name,
  archived,
  info,
  periods,
  isAdmin,
  t,
  errors,
}: {
  customerId: string;
  name: string;
  archived: boolean;
  info: CustomerInfo;
  periods: Period[];
  isAdmin: boolean;
  t: Dictionary["customers"];
  errors: Dictionary["errors"];
}) {
  const { message, show } = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "edit" | "renew">("view");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const current = periods[0];
  const proposal = current ? defaultRenewal(parseMonth(current.start)!, parseMonth(current.end)!) : null;
  const [start, setStart] = useState(proposal ? ym(proposal.start) : "");
  const [end, setEnd] = useState(proposal ? ym(proposal.end) : "");
  const [renewError, setRenewError] = useState<string | null>(null);
  const f = t.fields;

  const startM = parseMonth(start);
  const endM = parseMonth(end);
  const preview = startM && endM ? { label: formatPeriod(startM, endM, t.months), code: periodCode(startM, endM) } : null;
  const years = yearsAround(new Date().getFullYear());

  if (mode === "edit") {
    return (
      <section aria-label={t.updateTitle} className={card}>
        <h2 className="text-lg font-semibold">{t.updateTitle}</h2>
        <CustomerForm mode="update" customerId={customerId} initial={info} t={t} errors={errors} onDone={() => setMode("view")} />
      </section>
    );
  }

  const rows: [string, string][] = [
    [f.name, info.name],
    [f.shortName, info.shortName],
    [f.contactPerson, info.contactPerson],
    [f.phone, info.phone],
    [f.email, info.email],
    [f.social, info.social],
    [f.contract, current ? current.label : t.noContract],
  ];

  return (
    <section aria-label={t.infoTitle} className={card}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="flex-1 text-lg font-semibold">{t.infoTitle}</h2>
        {isAdmin ? (
          <>
            <button type="button" className={btn.mint} onClick={() => setMode(mode === "renew" ? "view" : "renew")} aria-expanded={mode === "renew"}>
              {t.renew}
            </button>
            <button type="button" className={btn.primary} onClick={() => setMode("edit")}>
              {t.update}
            </button>
          </>
        ) : (
          <span className="rounded-full bg-mint px-3.5 py-2 text-[13px] font-semibold text-ink-soft">{t.adminOnly}</span>
        )}
      </div>

      {mode === "renew" && (
        <form
          className="flex flex-col gap-4 rounded-[22px] bg-mint p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setRenewError(null);
            startTransition(async () => {
              const result = await renewContract(customerId, start, end);
              if (!result.ok) return setRenewError(errors[result.error]);
              setMode("view");
              if (preview) show(fill(t.renewed, { period: preview.label }));
            });
          }}
        >
          <h3 className="text-base font-semibold">{t.renewTitle}</h3>
          {current && <p className="text-sm text-ink-soft">{fill(t.currentContract, { period: current.label })}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <MonthPicker label={f.contractStart} value={start || ym({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })} onChange={setStart} months={t.months} monthLabel={f.month} yearLabel={f.year} years={years} />
            <MonthPicker label={f.contractEnd} value={end || ym({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })} onChange={setEnd} months={t.months} monthLabel={f.month} yearLabel={f.year} years={years} />
          </div>
          {preview && (
            <div className="flex flex-col gap-1.5 rounded-[18px] bg-white px-4 py-3.5">
              <span className="text-base font-semibold">{fill(t.newContract, { period: preview.label })}</span>
              <span className="text-[13px] leading-normal text-ink-soft">
                {fill(t.newIdsUse, { code: preview.code, example: `${info.shortName}-vid-${preview.code}-1` })}
              </span>
            </div>
          )}
          {renewError && (
            <p role="alert" className="text-sm font-medium text-danger">
              {renewError}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" className={btn.primary} disabled={pending}>
              {t.renew}
            </button>
            <button type="button" className={btn.soft} onClick={() => setMode("view")}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className={`break-words text-[15px] font-medium ${value ? "" : "text-muted"}`}>{value || t.notSet}</dd>
          </div>
        ))}
      </dl>

      {periods.length > 1 && (
        <div className="flex flex-col gap-1 border-t border-line pt-[18px]">
          <span className="text-xs font-semibold text-muted">{t.previous}</span>
          <span className="text-[15px] font-medium">{periods.slice(1).map((p) => p.label).join(" · ")}</span>
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-[18px]">
        <span className="text-xs font-semibold text-muted">{f.notes}</span>
        <p className={`max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed ${info.notes ? "" : "text-muted"}`}>{info.notes || t.notSet}</p>
      </div>

      {isAdmin && !archived && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-[18px]">
          {confirmArchive ? (
            <ConfirmBar
              text={fill(t.archiveConfirm, { name })}
              confirmLabel={t.archive}
              cancelLabel={t.cancel}
              disabled={pending}
              onCancel={() => setConfirmArchive(false)}
              onConfirm={() =>
                startTransition(async () => {
                  const result = await setCustomerArchived(customerId, true);
                  if (!result.ok) return show(errors[result.error], "error");
                  setConfirmArchive(false);
                  show(fill(t.archived, { name }));
                })
              }
            />
          ) : (
            <button type="button" className={`${btn.mint} self-start`} onClick={() => setConfirmArchive(true)}>
              {t.archive}
            </button>
          )}
        </div>
      )}
      <Toast message={message} />
    </section>
  );
}
