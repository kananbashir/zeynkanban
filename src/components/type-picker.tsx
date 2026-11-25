"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { TaskTypeIcon } from "./task-type-icon";

export type PickerType = { id: string; name: string; icon?: string };
type Labels = { placeholder: string; search: string; none: string; other: string; otherHint: string };

const CHEVRON = "m6 9 6 6 6-6";
const CHECK = "m5 12 5 5L20 7";
const SEARCH = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";
const LINES = "M4 6h16M4 12h16M4 18h10";
const PEN = "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z";

function Icon({ d, size = 18, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}

const lower = (s: string) => s.toLocaleLowerCase("az");

/** The name with the searched part marked. */
function Marked({ name, query }: { name: string; query: string }) {
  const at = query ? lower(name).indexOf(lower(query)) : -1;
  if (at < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <mark className="rounded bg-sun/45 px-px text-inherit">{name.slice(at, at + query.length)}</mark>
      {name.slice(at + query.length)}
    </>
  );
}

/**
 * The task type as a dropdown: one field showing the picked type; it opens a list with a search box,
 * the types with their icons and "Other…" at the bottom. Keyboard: ↑ ↓ to move, Enter to pick, Esc to
 * close. The list unfolds from the field (or above it when there is no room below), a highlight glides
 * from row to row, and a pick pops its ✓ before the list folds back.
 */
export function TypePicker({ types, value, other, onChange, labelledBy, labels }: { types: PickerType[]; value: string; other: string; onChange: (id: string) => void; labelledBy: string; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const [place, setPlace] = useState<{ up: boolean; max: number }>({ up: false, max: 320 });
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const glide = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const lastHeight = useRef(0);

  const shown = types.filter((x) => !query.trim() || lower(x.name).includes(lower(query.trim())));
  const options = [...shown.map((x) => x.id), other];
  const current = value === other ? { id: other, name: labels.other, icon: undefined } : types.find((x) => x.id === value);
  const selected = picked ?? value;

  // Opening: above or below the field, as tall as the screen allows; it unfolds from the field.
  useLayoutEffect(() => {
    if (!open || closing || !trigger.current || !panel.current) return;
    const r = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 16;
    const above = r.top - 16;
    const up = below < 300 && above > below;
    const chrome = 130; // the search box, "Other…" and the padding
    setPlace({ up, max: Math.max(150, Math.min(340, (up ? above : below) - chrome)) });
    lastHeight.current = 0;
    if (!prefersReducedMotion()) panel.current.animate([{ opacity: 0, transform: `translateY(${up ? 6 : -6}px) scaleY(0.96)` }, { opacity: 1, transform: "none" }], { duration: 240, easing: springOrFallback(420, 32, 0.24) });
    // On a computer you can type straight away; on a phone the keyboard stays down until asked for.
    if (window.matchMedia("(pointer: fine)").matches) search.current?.focus({ preventScroll: true });
    const i = options.indexOf(value);
    setActive(i);
    if (i >= 0) list.current?.querySelector(`[data-option="${CSS.escape(options[i])}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, closing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Searching: the list eases to its new height.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const height = el.offsetHeight;
    if (lastHeight.current && lastHeight.current !== height && !prefersReducedMotion()) el.animate([{ height: `${lastHeight.current}px` }, { height: `${height}px` }], { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    lastHeight.current = height;
  }, [query, open]);

  // The highlight glides to the active row (mouse or arrows).
  useLayoutEffect(() => {
    const g = glide.current;
    const row = active >= 0 ? panel.current?.querySelector<HTMLElement>(`[data-option="${CSS.escape(options[active] ?? "")}"]`) : null;
    if (!g) return;
    if (!row || row.dataset.option === other) {
      g.style.opacity = "0";
      return;
    }
    const first = g.style.opacity !== "1";
    g.style.transition = first ? "none" : "";
    g.style.transform = `translateY(${row.offsetTop}px)`;
    g.style.height = `${row.offsetHeight}px`;
    g.style.opacity = "1";
  });

  const close = (then?: () => void, refocus = false) => {
    const done = () => {
      setOpen(false);
      setClosing(false);
      setQuery("");
      setPicked(null);
      setActive(-1);
      then?.();
      if (refocus) trigger.current?.focus({ preventScroll: true });
    };
    const el = panel.current;
    if (!el || prefersReducedMotion()) return done();
    setClosing(true);
    el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(${place.up ? 6 : -6}px) scaleY(0.96)` }], { duration: 150, easing: "ease-in", fill: "forwards" }).finished.then(done, done);
  };

  // A pick shows its ✓ for a moment, then the list folds back and the field takes the new type.
  const choose = (id: string) => {
    if (closing) return;
    setPicked(id);
    setTimeout(() => close(() => onChange(id), true), prefersReducedMotion() ? 0 : 140);
  };

  // A click or tap anywhere else closes it; so does Escape (only the list, not the window it is in).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(undefined, true);
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  });

  const move = (step: number) => {
    const next = active < 0 ? (step > 0 ? 0 : options.length - 1) : (active + step + options.length) % options.length;
    setActive(next);
    list.current?.querySelector(`[data-option="${CSS.escape(options[next])}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && options[active]) choose(options[active]);
    } else if (e.key === "Tab") close();
  };

  const row = (id: string, i: number, body: React.ReactNode, delay: number) => (
    <div
      key={id}
      id={`type-${id}`}
      role="option"
      aria-selected={selected === id}
      data-option={id}
      onPointerMove={() => active !== i && setActive(i)}
      onClick={() => choose(id)}
      style={{ animationDelay: `${Math.min(delay, 16) * 12}ms` }}
      className={`zk-row-in relative z-[1] flex min-h-11 cursor-pointer items-center gap-3 rounded-[13px] px-2.5 text-sm transition-colors duration-200 ${selected === id ? "bg-teal-tint font-semibold" : "font-medium"}`}
    >
      {body}
      {selected === id && (
        <span key={picked ?? "now"} className={`ml-auto flex text-teal-deep ${picked === id ? "zk-pop" : ""}`}>
          <Icon d={CHECK} />
        </span>
      )}
    </div>
  );

  return (
    <div ref={box} className={`relative ${open ? "z-30" : ""}`} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelledBy} type-picker-value`}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex min-h-[52px] w-full items-center gap-3 rounded-[18px] border-2 pl-2 pr-3.5 text-left text-[15px] font-semibold transition-[border-color,background-color] duration-200 sm:min-h-14 ${open && !closing ? "border-teal bg-mint-soft" : "border-transparent bg-mint-soft hover:bg-mint"}`}
      >
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface ${current ? "text-teal-deep" : "text-muted"}`}>
          {current?.icon ? <TaskTypeIcon key={current.id} name={current.icon} size={18} className="zk-pop" /> : current ? <Icon key="pen" d={PEN} className="zk-pop" /> : <Icon d={LINES} />}
        </span>
        <span id="type-picker-value" key={current?.id ?? "none"} className={`zk-type-in min-w-0 flex-1 truncate ${current ? "" : "font-medium text-muted"}`}>
          {current ? current.name : labels.placeholder}
        </span>
        <Icon d={CHEVRON} className={`text-icon transition-transform duration-300 ${open && !closing ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={panel}
          className={`absolute inset-x-0 z-30 flex flex-col rounded-[20px] border border-line bg-surface p-2 shadow-[0_18px_44px_rgba(24,35,47,0.28)] ${place.up ? "bottom-[calc(100%+8px)] origin-bottom" : "top-[calc(100%+8px)] origin-top"}`}
        >
          <label className="mb-1.5 flex min-h-11 items-center gap-2.5 rounded-[14px] border-[1.5px] border-transparent bg-mint-soft px-3 text-muted transition-colors focus-within:border-line-strong">
            <Icon d={SEARCH} />
            <input
              ref={search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={labels.search}
              aria-label={labels.search}
              aria-controls="type-picker-list"
              aria-activedescendant={active >= 0 && options[active] ? `type-${options[active]}` : undefined}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-none"
            />
          </label>
          <div ref={list} id="type-picker-list" role="listbox" aria-labelledby={labelledBy} className="relative flex flex-col gap-0.5 overflow-y-auto overscroll-contain" style={{ maxHeight: place.max }}>
            <div ref={glide} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 rounded-[13px] bg-mint-soft opacity-0 transition-[transform,height,opacity] duration-200 ease-out" />
            {shown.map((x, i) =>
              row(
                x.id,
                i,
                <>
                  <TaskTypeIcon name={x.icon} size={18} className="text-teal-deep" />
                  <span className="min-w-0">
                    <Marked name={x.name} query={query.trim()} />
                  </span>
                </>,
                i,
              ),
            )}
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-muted">{labels.none}</p>}
          </div>
          <div className="mx-1.5 my-1 h-px bg-line" />
          <div className="relative">
            {row(
              other,
              options.length - 1,
              <>
                <Icon d={PEN} className="text-teal-deep" />
                <span>
                  {labels.other} <span className="font-normal text-muted">{labels.otherHint}</span>
                </span>
              </>,
              shown.length,
            )}
            {active === options.length - 1 && <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[13px] bg-mint-soft" />}
          </div>
        </div>
      )}
    </div>
  );
}
