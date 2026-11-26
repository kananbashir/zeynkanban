"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { saveTheme } from "@/app/actions/preferences";
import { Icon } from "@/components/icons";
import { SegmentedControl } from "@/components/motion";
import { card } from "@/components/ui";
import { setLocale } from "@/i18n/actions";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
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
          <ThemeCards value={theme} onChange={choose} labels={{ light: p.light, system: p.system, dark: p.dark }} group={p.appearance} />
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
          {label("sparkle", p.whatsNew, p.whatsNewHint)}
          <Link href="/about#versions" className="flex min-h-11 items-center gap-2 rounded-full bg-mint px-4 text-sm font-semibold hover:bg-teal-tint">
            {p.whatsNew}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** A small picture of the page in each theme. */
function Preview({ theme }: { theme: Theme }) {
  if (theme === "system") return <span className="block h-[78px] rounded-xl bg-[linear-gradient(115deg,#edf6f4_50%,#101b22_50%)]" />;
  const [bg, side, block] = theme === "light" ? ["#edf6f4", "#ffffff", "#ffffff"] : ["#101b22", "#1b2a33", "#22333d"];
  return (
    <span className="flex h-[78px] gap-[5px] overflow-hidden rounded-xl p-[7px]" style={{ background: bg }}>
      <i className="block w-[18px] rounded-[5px]" style={{ background: side }} />
      <span className="flex flex-1 flex-col gap-[5px]">
        <i className="block h-3.5 rounded-[5px]" style={{ background: block }} />
        <i className="block h-6 rounded-[5px]" style={{ background: block }} />
        <i className="block h-3.5 w-3/5 rounded-[5px]" style={{ background: block }} />
      </span>
    </span>
  );
}

/** Light, System and Dark as small previews; a teal ring glides to the chosen one. */
function ThemeCards({ value, onChange, labels, group }: { value: Theme; onChange: (theme: Theme) => void; labels: Record<Theme, string>; group: string }) {
  const box = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const placed = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const card = box.current?.querySelector<HTMLElement>(`[data-theme-card="${value}"]`);
      const el = ring.current;
      if (!card || !el) return;
      const to = { x: card.offsetLeft - 3, y: card.offsetTop - 3 };
      Object.assign(el.style, { transform: `translate(${to.x}px, ${to.y}px)`, width: `${card.offsetWidth + 6}px`, height: `${card.offsetHeight + 6}px`, opacity: "1" });
      const from = placed.current;
      if (animate && from && !prefersReducedMotion() && (from.x !== to.x || from.y !== to.y))
        el.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }], { duration: 520, easing: springOrFallback(420, 26, 0.52) });
      placed.current = to;
    };
    place(true);
    const observer = new ResizeObserver(() => place(false));
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [value]);
  return (
    <div ref={box} role="group" aria-label={group} className="relative flex flex-wrap gap-3">
      {(["light", "system", "dark"] as const).map((key) => (
        <button
          key={key}
          type="button"
          data-theme-card={key}
          aria-pressed={value === key}
          onClick={(e) => {
            onChange(key);
            if (!prefersReducedMotion()) e.currentTarget.animate([{ transform: "scale(0.96)" }, { transform: "none" }], { duration: 420, easing: springOrFallback(420, 26, 0.42) });
          }}
          className="flex w-[124px] flex-col rounded-[18px] bg-mint-soft p-2 text-left sm:w-[150px]"
        >
          <Preview theme={key} />
          <span className="mx-1 mb-0.5 mt-2 text-[13.5px] font-bold">{labels[key]}</span>
        </button>
      ))}
      <span ref={ring} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-[20px] border-[2.5px] border-teal opacity-0" />
    </div>
  );
}
