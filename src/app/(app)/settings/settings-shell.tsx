"use client";

import { useRouter } from "next/navigation";
import { Fragment, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Collapse } from "@/components/motion";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

export type NavSection = { key: string; label: string; count?: number };

const ICONS: Record<string, string> = {
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  statuses: "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M8 12l3 3 5-6",
  types: "m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5",
  content: "M4 4h16v16H4zM9 4v16",
  brief: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  days: "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18",
  preferences: "M12 3a9 9 0 1 0 9 9c0-.5-.4-1-1-1h-3a3 3 0 0 1-3-3V5c0-.6-.5-1-1-1zM7.5 10.5h.01M10.5 7h.01M7.5 14.5h.01",
};

/**
 * Settings with its section menu: icons and counts, a teal pill that slides to the chosen section
 * (along the top as chips on phones), and the section fading across when switching.
 */
export function SettingsShell({ sections, current, label, sectionLabel, children }: { sections: NavSection[]; current: string; label: string; sectionLabel: string; children: ReactNode }) {
  const router = useRouter();
  const [chosen, setChosen] = useState(current);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setChosen(current);
  }
  const [pending, startTransition] = useTransition();
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // The pill sits behind the chosen link; on a change it glides there with a little spring.
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const link = nav.current?.querySelector<HTMLElement>(`[data-section="${chosen}"]`);
      const el = pill.current;
      if (!link || !el) return;
      const to = { x: link.offsetLeft, y: link.offsetTop, w: link.offsetWidth, h: link.offsetHeight };
      const from = placed.current;
      Object.assign(el.style, { transform: `translate(${to.x}px, ${to.y}px)`, width: `${to.w}px`, height: `${to.h}px`, opacity: "1" });
      if (animate && from && !prefersReducedMotion() && (from.x !== to.x || from.y !== to.y))
        el.animate(
          [
            { transform: `translate(${from.x}px, ${from.y}px)`, width: `${from.w}px`, height: `${from.h}px` },
            { transform: `translate(${to.x}px, ${to.y}px)`, width: `${to.w}px`, height: `${to.h}px` },
          ],
          { duration: 520, easing: springOrFallback(420, 26, 0.52) },
        );
      placed.current = to;
      // On phones, keep the chosen chip in view.
      if (animate && nav.current && nav.current.scrollWidth > nav.current.clientWidth) link.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest", inline: "center" });
    };
    place(true);
    const observer = new ResizeObserver(() => place(false));
    if (nav.current) observer.observe(nav.current);
    return () => observer.disconnect();
  }, [chosen]);

  // Phones: the sections are a dropdown.
  const [menu, setMenu] = useState(false);
  const go = (key: string) => {
    setMenu(false);
    if (key === chosen) return;
    setChosen(key);
    startTransition(() => router.push(`/settings?section=${key}`, { scroll: false }));
  };

  return (
    <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-[22px]">
      <SectionDropdown sections={sections} chosen={chosen} open={menu} label={label} sectionLabel={sectionLabel} onToggle={() => setMenu((v) => !v)} onGo={go} />
      <nav
        ref={nav}
        aria-label={label}
        className="relative flex shrink-0 gap-0.5 overflow-x-auto rounded-[22px] bg-surface p-1.5 [scrollbar-width:none] max-lg:hidden lg:w-[260px] lg:flex-col lg:overflow-visible lg:rounded-[28px] lg:p-2.5"
      >
        <span ref={pill} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-[16px] bg-teal opacity-0 lg:rounded-[18px]" />
        {sections.map((s) => {
          const on = s.key === chosen;
          return (
            <Fragment key={s.key}>
              {s.key === "preferences" && sections.length > 1 && <span aria-hidden="true" className="mx-2 my-1.5 hidden h-px bg-line lg:block" />}
              <a
                href={`/settings?section=${s.key}`}
                data-section={s.key}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  go(s.key);
                }}
                className={`relative z-[1] flex shrink-0 items-center gap-3 whitespace-nowrap rounded-[16px] px-3 py-2 text-sm font-semibold transition-colors duration-[250ms] lg:min-h-[54px] lg:rounded-[18px] lg:py-2.5 lg:text-[14.5px] ${on ? "text-white" : "text-ink hover:bg-mint-soft"}`}
              >
                <span aria-hidden="true" className={`hidden size-[34px] shrink-0 items-center justify-center rounded-[11px] transition-colors duration-[250ms] lg:flex ${on ? "bg-white/15 text-white" : "bg-mint text-teal-deep"}`}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICONS[s.key]} />
                  </svg>
                </span>
                <span className="lg:min-w-0 lg:flex-1 lg:whitespace-normal">{s.label}</span>
                {s.count !== undefined && (
                  <span key={s.count} className={`zk-pop hidden rounded-full px-2 py-0.5 text-xs font-bold transition-colors duration-[250ms] lg:inline ${on ? "bg-white/20 text-white" : "bg-mint-soft text-muted"}`}>
                    {s.count}
                  </span>
                )}
              </a>
            </Fragment>
          );
        })}
      </nav>
      <div key={current} className={`zk-section-in flex min-w-0 flex-1 flex-col gap-5 transition-[opacity,transform] duration-150 ease-in ${pending ? "translate-y-1.5 opacity-0" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function SectionIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/**
 * On phones: the chosen section as a button (icon, name, count); tapping it unfolds the list of
 * sections underneath, the chosen one ticked. Picking one folds the list away again.
 */
function SectionDropdown({ sections, chosen, open, label, sectionLabel, onToggle, onGo }: { sections: NavSection[]; chosen: string; open: boolean; label: string; sectionLabel: string; onToggle: () => void; onGo: (key: string) => void }) {
  const current = sections.find((s) => s.key === chosen) ?? sections[0];
  if (!current || sections.length < 2) return null;
  return (
    <nav aria-label={label} className="flex flex-col gap-2 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
        className={`flex min-h-14 items-center gap-2.5 rounded-[18px] border-[1.5px] bg-surface px-3.5 text-left transition-[border-color,box-shadow] duration-200 ${open ? "border-teal shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-teal)_30%,transparent)]" : "border-line-strong"}`}
      >
        <span key={current.key} className="zk-pop flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-teal text-white">
          <SectionIcon name={current.key} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[11px] font-semibold text-muted">{sectionLabel}</span>
          <span key={current.key} className="zk-fade-up truncate text-[15px] font-semibold">{current.label}</span>
        </span>
        {current.count !== undefined && <span className="text-xs font-bold tabular-nums text-muted">{current.count}</span>}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-icon transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <Collapse open={open}>
        <div className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-1.5">
          {sections.map((s) => {
            const on = s.key === chosen;
            return (
              <a
                key={s.key}
                href={`/settings?section=${s.key}`}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onGo(s.key);
                }}
                className={`flex min-h-[46px] items-center gap-2.5 rounded-xl px-2.5 text-sm font-semibold transition-colors ${on ? "bg-teal-tint" : "hover:bg-mint-soft"}`}
              >
                <span aria-hidden="true" className={`flex size-[30px] shrink-0 items-center justify-center rounded-[10px] ${on ? "bg-teal text-white" : "bg-mint text-teal-deep"}`}>
                  <SectionIcon name={s.key} size={16} />
                </span>
                <span className="min-w-0 flex-1">{s.label}</span>
                {s.count !== undefined && <span className="text-xs font-bold tabular-nums text-muted">{s.count}</span>}
                <span className="flex w-4 justify-center text-teal-deep">
                  {on && (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="zk-pop">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  )}
                </span>
              </a>
            );
          })}
        </div>
      </Collapse>
    </nav>
  );
}
