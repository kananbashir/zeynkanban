"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MonthPicker, yearsAround } from "@/components/month-picker";
import { btn, field } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { createCustomer, updateCustomer } from "./actions";

export type CustomerInfo = { name: string; shortName: string; contactPerson: string; phone: string; email: string; social: string; notes: string };

function thisMonth(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The customer details form: creates a customer (with their first contract) or updates one. */
export function CustomerForm({
  mode,
  customerId,
  initial,
  t,
  errors,
  onDone,
}: {
  mode: "create" | "update";
  customerId?: string;
  initial?: CustomerInfo;
  t: Dictionary["customers"];
  errors: Dictionary["errors"];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<CustomerInfo>(initial ?? { name: "", shortName: "", contactPerson: "", phone: "", email: "", social: "", notes: "" });
  const [start, setStart] = useState(thisMonth());
  const [end, setEnd] = useState(thisMonth(1));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const f = t.fields;
  const years = yearsAround(new Date().getFullYear());

  const input = (key: keyof CustomerInfo, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <input className={field} value={info[key]} onChange={(e) => setInfo({ ...info, [key]: e.target.value })} autoComplete="off" {...props} />
    </label>
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = mode === "create" ? await createCustomer({ ...info, start, end }) : await updateCustomer(customerId!, info);
          if (!result.ok) return setError(errors[result.error]);
          if (mode === "create" && result.id) router.push(`/customers/${result.id}?tab=contents`);
          onDone?.();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {input("name", f.name, { required: true, maxLength: 120 })}
        <div className="flex flex-col gap-1.5">
          {input("shortName", f.shortName, {
            required: true,
            maxLength: 20,
            spellCheck: false,
            autoCapitalize: "none",
            className: `${field} font-mono text-sm`,
            onChange: (e) => setInfo({ ...info, shortName: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }),
          })}
          <span className="text-xs text-muted">{f.shortNameHelp}</span>
        </div>
        {input("contactPerson", f.contactPerson, { maxLength: 120 })}
        {input("phone", f.phone, { maxLength: 40, inputMode: "tel" })}
        {input("email", f.email, { maxLength: 120, type: "email" })}
        {input("social", f.social, { maxLength: 200 })}
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        {f.notes}
        <textarea className={`${field} h-24 py-3`} value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} maxLength={5000} />
      </label>
      {mode === "create" ? (
        <div className="grid gap-4 rounded-[22px] bg-mint p-4 sm:grid-cols-2">
          <MonthPicker label={`${f.contract}: ${f.contractStart}`} value={start} onChange={setStart} months={t.months} monthLabel={f.month} yearLabel={f.year} years={years} />
          <MonthPicker label={`${f.contract}: ${f.contractEnd}`} value={end} onChange={setEnd} months={t.months} monthLabel={f.month} yearLabel={f.year} years={years} />
        </div>
      ) : (
        <p className="text-[13px] text-muted">{t.contractNote}</p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" className={btn.primary} disabled={pending || !info.name.trim() || info.shortName.length < 2}>
          {mode === "create" ? t.create : t.save}
        </button>
        <button type="button" className={btn.mint} onClick={() => (onDone ? onDone() : router.back())}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
