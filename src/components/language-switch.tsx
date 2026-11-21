"use client";

import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/dictionaries";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "az", label: "AZ" },
  { value: "en", label: "EN" },
];

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-white p-1">
      {OPTIONS.map((option) => {
        const active = option.value === locale;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => !active && startTransition(() => setLocale(option.value))}
            className={`h-11 min-w-11 rounded-full text-[13px] font-semibold ${active ? "bg-teal text-white" : "text-icon hover:bg-mint"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
