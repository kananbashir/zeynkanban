"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { addDays, weekdayIndex } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { filterCount, filterDay, filterOptions, NO_FILTERS, SECTIONS, type Filters, type Option } from "@/lib/task-filters";
import type { Section } from "@/lib/task-rules";
import type { DayTasks } from "@/lib/tasks";
import { typeColor } from "@/lib/type-colors";
import { FilterBar, type FilterGroup } from "./filter-bar";
import { useIsWide } from "./motion";
import { Sheet, useSheetClose } from "./sheet";

type TaskT = Dictionary["tasks"];
export type ContentTypeName = { code: string; name: string };

const SECTION_DOTS: Record<Section, string> = {
  overdue: "var(--color-danger)",
  due: "var(--color-teal)",
  postponed: "var(--color-status-amber)",
  finished: "var(--color-leaf)",
  cancelled: "var(--color-subtle)",
};

/**
 * The filters of a day's task list and what they show: the groups for the filter bar (status,
 * customers, people on the board, content types), the filtered day, and how many are picked.
 * The picks are kept when moving to another day.
 */
export function useDayFilters({ day, contentTypes, t, date, staff, people }: { day: DayTasks; contentTypes: ContentTypeName[]; t: TaskT; date: string; staff: boolean; people: boolean }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // Names of customers and people picked earlier, so a pick with nothing on this day still shows.
  const [known, setKnown] = useState<{ customers: Option[]; people: Option[] }>({ customers: [], people: [] });
  const options = useMemo(() => filterOptions(day, filters, known), [day, filters, known]);
  const filtered = useMemo(() => filterDay(day, filters), [day, filters]);
  const f = t.filters;
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((old) => ({ ...old, [key]: value }));
  const remember = (key: "customers" | "people", ids: string[], list: Option[]) =>
    setKnown((old) => ({ ...old, [key]: [...old[key].filter((o) => !ids.includes(o.id)), ...list.filter((o) => ids.includes(o.id))] }));
  const typeName = (code: string) => contentTypes.find((x) => x.code === code)?.name ?? code;

  const groups: FilterGroup[] = [
    {
      key: "status",
      label: f.status,
      all: fill(f.allStatuses, { n: options.total }),
      choices: SECTIONS.map((s) => ({ id: s, label: t.board.segments[s], count: options.sections[s], dot: SECTION_DOTS[s] })),
      selected: filters.sections,
      onChange: (ids) => set("sections", ids as Section[]),
      hint: fill(f.statusHint, { n: options.total }),
    },
    {
      key: "customers",
      label: f.customers,
      all: f.allCustomers,
      choices: options.customers.map((c) => ({ ...c, dot: c.color, ring: true })),
      selected: filters.customers,
      onChange: (ids) => {
        remember("customers", ids, options.customers);
        set("customers", ids);
      },
      search: f.searchCustomers,
      foot: options.customers.length === 1 ? f.customers1 : fill(f.customersN, { n: options.customers.length }),
      ...(staff
        ? { link: (id: string) => `/customers/${id}?tab=tasks&date=${date}`, linkLabel: (name: string) => fill(f.openCustomer, { name }), hint: f.openHint }
        : {}),
    },
    ...(people
      ? [
          {
            key: "people" as const,
            label: f.assignees,
            all: f.everyone,
            choices: options.people.map((p) => ({ ...p, avatar: true })),
            selected: filters.people,
            onChange: (ids: string[]) => {
              remember("people", ids, options.people);
              set("people", ids);
            },
            search: f.searchPeople,
            foot: options.people.length === 1 ? f.people1 : fill(f.peopleN, { n: options.people.length }),
          },
        ]
      : []),
    {
      key: "types",
      label: f.types,
      all: f.allTypes,
      choices: options.types.map((x) => ({ ...x, label: typeName(x.id), dot: typeColor(x.id, contentTypes) })),
      selected: filters.types,
      onChange: (ids) => set("types", ids),
      hint: f.typesHint,
    },
  ];
  const shown = SECTIONS.reduce((n, s) => n + filtered[s].length, 0);
  return {
    filters,
    query: filters.query,
    setQuery: (q: string) => set("query", q),
    filtered,
    shown,
    groups,
    count: filterCount(filters),
    clearAll: () => setFilters((old) => ({ ...NO_FILTERS, query: old.query })),
  };
}

/** The search box across the header. */
export function TaskSearch({ value, onChange, label, className = "" }: { value: string; onChange: (v: string) => void; label: string; className?: string }) {
  return (
    <label className={`flex h-12 w-full min-w-0 items-center gap-2.5 rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-muted focus-within:border-teal ${className}`}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" className="shrink-0">
        <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
      </svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-none" />
    </label>
  );
}

/** Bottom of the page's frame on a computer: the layout's outer and inner padding (see (app)/layout). */
const FRAME_BOTTOM = 44;

/**
 * On a computer, makes the element exactly as tall as the rest of the screen, so the page itself
 * doesn't scroll and only the part inside that is allowed to scroll does. On very short screens
 * (and on phones) it leaves the height alone and the page scrolls as usual.
 */
export function useFitHeight(ref: RefObject<HTMLElement | null>) {
  const wide = useIsWide();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!wide) {
      el.style.height = "";
      return;
    }
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const height = window.innerHeight - top - FRAME_BOTTOM;
      el.style.height = height >= 480 ? `${height}px` : "";
      el.toggleAttribute("data-fit", height >= 480);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [ref, wide]);
}

/**
 * The task list's scrolling area: it fades at its top edge once scrolled (so it is clear more is
 * above), and says when it is properly scrolled (`compact`), so the date line above can fold away
 * and give the list more room; back at the top, it comes back. Only when there is plenty to scroll,
 * so folding it can't leave the list with nothing left to scroll.
 */
export function useScrolledEdge() {
  const [scrolled, setScrolled] = useState(false);
  const [compact, setCompact] = useState(false);
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const top = el.scrollTop;
    if (top > 4 !== scrolled) setScrolled(top > 4);
    if (!compact && top > 24 && el.scrollHeight - el.clientHeight > 240) setCompact(true);
    else if (compact && top <= 2) setCompact(false);
  };
  return { onScroll, compact, edge: scrolled ? "[mask-image:linear-gradient(to_bottom,transparent,black_20px)]" : "" };
}

/**
 * On a phone, once the filters have scrolled out of view: a slim bar along the top with the day
 * (‹ › to change it) and a Filter button showing how many filters are picked. It slides away when
 * the header comes back.
 */
export function StickyDayBar({
  watch,
  title,
  date,
  onGo,
  t,
  count,
  onFilter,
}: {
  watch: RefObject<HTMLElement | null>;
  title: string;
  date: string;
  onGo: (iso: string) => void;
  t: TaskT;
  count: number;
  onFilter: () => void;
}) {
  const wide = useIsWide();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = watch.current;
    if (wide || !el) return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [watch, wide]);
  if (wide) return null;
  const arrow = (d: string, label: string, to: string) => (
    <button type="button" aria-label={label} onClick={() => onGo(to)} className="flex size-10 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  );
  return (
    <div
      role="region"
      aria-label={t.filters.label}
      aria-hidden={!shown}
      inert={!shown}
      data-sticky-day={shown ? "shown" : "hidden"}
      className={`fixed inset-x-3 top-[max(10px,env(safe-area-inset-top))] z-30 flex items-center gap-1 rounded-[22px] bg-surface/95 py-1.5 pl-1 pr-1.5 shadow-[0_10px_28px_rgba(24,35,47,0.3)] backdrop-blur-md transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${shown ? "translate-y-0 opacity-100" : "-translate-y-[140%] opacity-0"}`}
    >
      {arrow("m15 18-6-6 6-6", t.prevDay, addDays(date, -1))}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[11px] font-semibold text-teal-deep">{title}</span>
        <span className="truncate text-base font-semibold">{`${t.weekdaysShort[weekdayIndex(date)]}, ${shortDate(date, t)}`}</span>
      </span>
      {arrow("m9 18 6-6-6-6", t.nextDay, addDays(date, 1))}
      <button type="button" onClick={onFilter} className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full bg-teal px-3.5 text-sm font-semibold text-white">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
        </svg>
        {t.filters.filter}
        {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-extrabold text-teal">{count}</span>}
      </button>
    </div>
  );
}

function ShowButton({ label }: { label: string }) {
  const close = useSheetClose();
  return (
    <button type="button" onClick={close} className="min-h-12 w-full rounded-full bg-sun text-[15px] font-bold text-on-pastel">
      {label}
    </button>
  );
}

/** The phone's filter sheet (from the slim bar): the search box, every filter, and "Show N tasks". */
export function FilterSheet({ onClose, groups, query, setQuery, onClearAll, shown, t }: { onClose: () => void; groups: FilterGroup[]; query: string; setQuery: (q: string) => void; onClearAll: () => void; shown: number; t: TaskT }) {
  const f = t.filters;
  return (
    <Sheet
      label={f.filter}
      onClose={onClose}
      header={
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{f.filter}</h2>
          <button type="button" onClick={onClearAll} className="min-h-9 text-[13px] font-bold text-teal-deep">
            {f.clearAll}
          </button>
        </div>
      }
      footer={<ShowButton label={shown === 1 ? f.show1 : fill(f.show, { n: shown })} />}
    >
      <div className="flex flex-col gap-3 pb-1">
        <TaskSearch value={query} onChange={setQuery} label={t.board.search} />
        <FilterBar groups={groups} t={f} onClearAll={onClearAll} columns={1} />
      </div>
    </Sheet>
  );
}
