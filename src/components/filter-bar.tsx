"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { personColor } from "./avatar-group";
import { Collapse, useIsWide } from "./motion";
import { initials } from "./top-bar";

type T = Dictionary["tasks"]["filters"];

export const FILTER_ICONS = {
  status: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2",
  customers: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  people: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  types: "m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5",
} as const;
const CHEVRON = "m6 9 6 6 6-6";
const CHECK = "m5 12 5 5L20 7";
const OPEN = "M7 17 17 7M8 7h9v9";
const X = "M18 6 6 18M6 6l12 12";
const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";

function Icon({ d, size = 16, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}

/** One choice: a status, a customer, a person or a content type. `dot`: a colour; `avatar`: show initials. */
export type FilterChoice = { id: string; label: string; count: number; dot?: string; ring?: boolean; avatar?: boolean };
export type FilterGroup = {
  key: keyof typeof FILTER_ICONS;
  label: string;
  /** Shown when nothing is picked, e.g. "All customers". */
  all: string;
  choices: FilterChoice[];
  selected: string[];
  onChange: (ids: string[]) => void;
  search?: string;
  hint?: string;
  /** Shown at the foot of the list, e.g. "3 customers". */
  foot?: string;
  /** A link beside each choice (admins and managers: a customer's page on this day). */
  link?: (id: string) => string;
  linkLabel?: (name: string) => string;
};

function Swatch({ c, small = false }: { c: FilterChoice; small?: boolean }) {
  if (c.avatar)
    return (
      <span aria-hidden="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: personColor(c.id) }}>
        {initials(c.label)}
      </span>
    );
  if (!c.dot) return null;
  return <span aria-hidden="true" className={`shrink-0 rounded-full ${c.ring ? "size-3 border-[1.5px] border-black/25" : small ? "size-2" : "size-[9px]"}`} style={{ background: c.dot }} />;
}

/** The ticked list of one filter: an optional search box, the choices with their counts, and Clear. */
function ChoiceList({ group, t, autoFocus }: { group: FilterGroup; t: T; autoFocus: boolean }) {
  const [query, setQuery] = useState("");
  const shown = group.choices.filter((c) => !query.trim() || c.label.toLocaleLowerCase("az").includes(query.trim().toLocaleLowerCase("az")));
  const toggle = (id: string) => group.onChange(group.selected.includes(id) ? group.selected.filter((x) => x !== id) : [...group.selected, id]);
  return (
    <div className="flex flex-col gap-0.5">
      {group.search && group.choices.length > 5 && (
        <label className="mb-1 flex min-h-10 items-center gap-2 rounded-xl bg-mint-soft px-2.5 text-muted">
          <Icon d={SEARCH} size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={group.search}
            aria-label={group.search}
            autoFocus={autoFocus}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </label>
      )}
      <div role="group" aria-label={group.label} className="flex max-h-[min(340px,50vh)] flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {shown.map((c) => {
          const on = group.selected.includes(c.id);
          return (
            <div key={c.id} className="flex items-center gap-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(c.id)}
                className={`flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left text-sm transition-colors hover:bg-mint-soft ${c.count || on ? "text-ink" : "text-muted"}`}
              >
                <span aria-hidden="true" className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors ${on ? "border-teal bg-teal text-white" : "border-subtle"}`}>
                  {on && <Icon d={CHECK} size={12} className="zk-pop" />}
                </span>
                <Swatch c={c} />
                <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                <span className="text-xs font-semibold tabular-nums text-muted">{c.count}</span>
              </button>
              {group.link && (
                <Link
                  href={group.link(c.id)}
                  aria-label={group.linkLabel?.(c.label)}
                  title={group.linkLabel?.(c.label)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint"
                >
                  <Icon d={OPEN} size={15} />
                </Link>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="px-2.5 py-3 text-[13px] text-muted">{t.noMatch}</p>}
      </div>
      {group.hint && <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] leading-snug text-muted">{group.hint}</p>}
      {(group.foot || group.selected.length > 0) && (
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-2.5 pt-2 text-[12.5px] text-muted">
          <span>{group.foot}</span>
          {group.selected.length > 0 && (
            <button type="button" onClick={() => group.onChange([])} className="min-h-8 font-bold text-teal-deep">
              {t.clear}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The filters above a day's task list: one dropdown per filter, side by side with the same width
 * (two per row on phones). On a computer a list opens under its button; on a phone (or with
 * `inline`) it opens in place under the buttons. What is picked shows as chips with ×, plus Clear all.
 */
export function FilterBar({ groups, t, onClearAll, columns, className = "" }: { groups: FilterGroup[]; t: T; onClearAll: () => void; columns?: number; className?: string }) {
  const wide = useIsWide();
  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const floating = wide && !columns; // a list floats under its button only in the full-width bar on a computer
  const current = groups.find((g) => g.key === open) ?? null;

  useLayoutEffect(() => {
    if (!floating || !open || closing || !pop.current || prefersReducedMotion()) return;
    pop.current.animate([{ opacity: 0, transform: "translateY(-6px) scaleY(0.96)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: springOrFallback(420, 32, 0.24) });
  }, [open, closing, floating]);

  const close = () => {
    if (!open || closing) return;
    const done = () => {
      setOpen(null);
      setClosing(false);
    };
    if (!floating || !pop.current || prefersReducedMotion()) return done();
    setClosing(true);
    pop.current.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px) scaleY(0.96)" }], { duration: 150, easing: "ease-in", fill: "forwards" }).finished.then(done, done);
  };

  // A tap elsewhere or Escape closes a floating list (Escape closes only the list, not a window around it).
  useEffect(() => {
    if (!open || !floating) return;
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  });

  const toggle = (key: string) => (open === key ? close() : (setClosing(false), setOpen(key)));
  const picked = groups.flatMap((g) => g.selected.map((id) => ({ g, c: g.choices.find((c) => c.id === id) ?? { id, label: id, count: 0 } })));
  const summary = (g: FilterGroup) => (g.selected.length === 0 ? g.all : g.selected.length === 1 ? (g.choices.find((c) => c.id === g.selected[0])?.label ?? g.all) : fill(t.picked, { n: g.selected.length }));
  const cols = columns ?? groups.length;

  return (
    <div ref={bar} className={`flex flex-col gap-2.5 ${className}`}>
      <div
        className={`grid gap-2 ${columns ? "" : "grid-cols-2 sm:[grid-template-columns:var(--cols)]"}`}
        style={{ "--cols": `repeat(${cols}, minmax(0, 1fr))`, ...(columns ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : {}) } as React.CSSProperties}
      >
        {groups.map((g) => {
          const isOpen = open === g.key && !closing;
          const on = g.selected.length > 0;
          return (
            <div key={g.key} className="relative min-w-0">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label={`${g.label}: ${summary(g)}`}
                data-filter={g.key}
                onClick={() => toggle(g.key)}
                className={`flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border-[1.5px] pl-3.5 pr-3 text-left transition-[border-color,background-color,box-shadow] duration-200 ${on ? "border-teal bg-teal-tint" : "border-line-strong bg-mint-soft hover:bg-mint"} ${isOpen ? "border-teal shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-teal)_30%,transparent)]" : ""}`}
              >
                <Icon d={FILTER_ICONS[g.key]} className="text-teal-deep" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-[11px] font-semibold text-muted">{g.label}</span>
                  <span key={summary(g)} className="zk-fade-up truncate text-sm font-semibold">{summary(g)}</span>
                </span>
                {on && <span key={g.selected.length} className="zk-pop flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1.5 text-[11px] font-bold text-white">{g.selected.length}</span>}
                <Icon d={CHEVRON} size={15} className={`text-icon transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {floating && open === g.key && (
                <div ref={pop} className="absolute left-0 top-[calc(100%+8px)] z-30 w-full min-w-[280px] origin-top rounded-[20px] border border-line bg-surface p-2 shadow-[0_18px_44px_rgba(24,35,47,0.28)]">
                  <ChoiceList group={g} t={t} autoFocus />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!floating && (
        <Collapse open={!!current && !closing}>
          {current && (
            <div className="rounded-[18px] border border-line bg-surface p-2">
              <ChoiceList key={current.key} group={current} t={t} autoFocus={false} />
            </div>
          )}
        </Collapse>
      )}
      <Collapse open={picked.length > 0}>
        <div className="flex flex-wrap items-center gap-1.5 px-0.5">
          {picked.map(({ g, c }) => (
            <span key={`${g.key}-${c.id}`} className="zk-pop flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-mint pl-2.5 pr-1 text-[13px] font-semibold">
              <Swatch c={c} small />
              <span className="truncate">{c.label}</span>
              <button type="button" aria-label={fill(t.remove, { name: c.label })} onClick={() => g.onChange(g.selected.filter((x) => x !== c.id))} className="flex size-6 shrink-0 items-center justify-center rounded-full text-icon hover:bg-surface">
                <Icon d={X} size={13} />
              </button>
            </span>
          ))}
          <button type="button" onClick={onClearAll} className="min-h-8 px-2 text-[13px] font-bold text-teal-deep">
            {t.clearAll}
          </button>
        </div>
      </Collapse>
    </div>
  );
}
