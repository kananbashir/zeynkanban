"use client";

import { InlineText } from "@/components/inline-text";

/**
 * A name in Azerbaijani (the main language, required) with its English version underneath
 * (optional; when empty, English readers see the Azerbaijani name).
 */
export function BilingualName({
  name,
  nameEn,
  label,
  labelEn,
  placeholderEn,
  onSave,
  onSaveEn,
}: {
  name: string;
  nameEn: string | null;
  label: string;
  labelEn: string;
  placeholderEn: string;
  onSave: (next: string) => void;
  onSaveEn: (next: string) => void;
}) {
  const tag = "w-7 shrink-0 rounded-md bg-surface py-0.5 text-center text-[10px] font-bold tracking-wide text-muted";
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className={tag}>AZ</span>
        <InlineText value={name} label={label} onSave={onSave} />
      </div>
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className={tag}>EN</span>
        <InlineText value={nameEn ?? ""} label={labelEn} placeholder={placeholderEn} allowEmpty onSave={onSaveEn} className="h-8 text-[13px] font-medium text-ink-soft placeholder:font-normal placeholder:text-muted" />
      </div>
    </div>
  );
}
