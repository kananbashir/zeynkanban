"use client";

import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/dictionaries";
import { SegmentedControl } from "./motion";

export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  const [, startTransition] = useTransition();
  return (
    <SegmentedControl
      label={label}
      tone="teal"
      value={locale}
      onChange={(key) => key !== locale && startTransition(() => setLocale(key as Locale))}
      itemClassName="h-11 min-w-11 px-0 text-[13px]"
      items={[
        { key: "az", label: "AZ" },
        { key: "en", label: "EN" },
      ]}
    />
  );
}
