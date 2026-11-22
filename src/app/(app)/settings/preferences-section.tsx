"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveTheme } from "@/app/actions/preferences";
import { logout } from "@/app/login/actions";
import { Icon } from "@/components/icons";
import { SegmentedControl } from "@/components/motion";
import { card } from "@/components/ui";
import { setLocale } from "@/i18n/actions";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { applyTheme, type Theme } from "@/lib/theme";
import { SectionHeader } from "./section-header";

/** Appearance, language, About and log out: for everyone, saved on this device. */
export function PreferencesSection({ theme: initialTheme, locale, t, nav }: { theme: Theme; locale: Locale; t: Dictionary["settings"]; nav: Dictionary["nav"] }) {
  const p = t.prefs;
  const [theme, setTheme] = useState(initialTheme);
  const [, startTransition] = useTransition();
  const choose = (next: Theme) => {
    if (next === theme) return;
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  };
  const row = "flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-[18px] first:border-t-0 first:pt-0";
  const label = (icon: Parameters<typeof Icon>[0]["name"], title: string, hint: string) => (
    <div className="flex min-w-0 flex-[1_1_240px] items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint text-teal-deep">
        <Icon name={icon} size={18} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-ink-soft">{hint}</span>
      </span>
    </div>
  );
  return (
    <section aria-label={t.sections.preferences} className={card}>
      <SectionHeader title={t.sections.preferences} intro="" />
      <div className="flex flex-col gap-[18px]">
        <div className={row}>
          {label(theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor", p.appearance, p.appearanceHint)}
          <SegmentedControl
            label={p.appearance}
            value={theme}
            onChange={(key) => choose(key as Theme)}
            itemClassName="min-h-11 px-3.5 text-sm"
            items={(["light", "system", "dark"] as const).map((key) => ({
              key,
              label: (
                <span className="flex items-center gap-1.5">
                  <Icon name={key === "light" ? "sun" : key === "dark" ? "moon" : "monitor"} size={16} />
                  {p[key]}
                </span>
              ),
            }))}
          />
        </div>
        <div className={row}>
          {label("globe", p.language, p.languageHint)}
          <SegmentedControl
            label={p.language}
            value={locale}
            onChange={(key) => key !== locale && startTransition(() => setLocale(key as Locale))}
            itemClassName="min-h-11 px-4 text-sm"
            items={[
              { key: "az", label: "Azərbaycan" },
              { key: "en", label: "English" },
            ]}
          />
        </div>
        <div className={row}>
          {label("about", p.about, p.aboutHint)}
          <Link href="/about" className="flex min-h-11 items-center gap-2 rounded-full bg-mint px-4 text-sm font-semibold hover:bg-teal-tint">
            {nav.about}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <div className={row}>
          {label("logout", p.account, p.logoutHint)}
          <form action={logout}>
            <button type="submit" className="flex min-h-11 items-center gap-2 rounded-full bg-mint px-4 text-sm font-semibold hover:bg-teal-tint">
              <Icon name="logout" size={16} />
              {nav.logout}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
