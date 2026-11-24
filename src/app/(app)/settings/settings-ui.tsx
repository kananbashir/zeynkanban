"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmBar } from "@/components/confirm-bar";
import { Icon } from "@/components/icons";
import { useGrowIn } from "@/components/list-motion";
import { Collapse } from "@/components/motion";
import { TaskTypeIcon } from "@/components/task-type-icon";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { TASK_ICON_NAMES, type TaskIcon } from "@/lib/task-icons";

// The pieces every Settings section is built from: a header with a yellow "+ Add" button that
// opens a form, rows that open one at a time, an inline yellow "are you sure?", collapsible
// groups, and small controls. Everything moves smoothly; with "reduce motion" it just appears.

export const inputCls = "h-11 w-full min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted";
const BOUNCY = () => springOrFallback(420, 26, 0.62);

/** A small pop for something that appears (a confirm bar, a popover); nothing with reduced motion. */
export function popIn(el: HTMLElement | null, from = "translateY(6px) scale(0.98)") {
  if (el && !prefersReducedMotion()) el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 380, easing: BOUNCY() });
}

/**
 * Rows that should grow in now (just added, moved, brought back). The mark is dropped after a
 * moment, so a row first shown later (e.g. when its group is opened) simply appears.
 */
export function useFresh() {
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const mark = (id: string) => {
    setFresh((all) => new Set(all).add(id));
    setTimeout(() => setFresh((all) => {
      const next = new Set(all);
      next.delete(id);
      return next;
    }), 900);
  };
  return { isFresh: (id: string) => fresh.has(id), mark };
}

/**
 * Rows that move to another place in a list (e.g. a holiday whose date changed) glide there:
 * call `capture()` just before changing the order; rows are found by data-id inside `box`.
 */
export function useGlide(box: React.RefObject<HTMLElement | null>, order: string) {
  const before = useRef<Map<string, number> | null>(null);
  const tops = () => {
    const map = new Map<string, number>();
    box.current?.querySelectorAll<HTMLElement>("[data-id]").forEach((row) => map.set(row.dataset.id!, row.getBoundingClientRect().top));
    return map;
  };
  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    if (!from || prefersReducedMotion()) return;
    tops().forEach((top, id) => {
      const was = from.get(id);
      if (was !== undefined && Math.abs(was - top) > 1)
        box.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.animate([{ transform: `translateY(${was - top}px)` }, { transform: "none" }], { duration: 520, easing: springOrFallback(380, 34, 0.52) });
    });
  }, [box, order]); // eslint-disable-line react-hooks/exhaustive-deps
  return { capture: () => void (before.current = tops()) };
}

/** The yellow "+ Add …" button; its + turns into × while the form is open. */
export function AddButton({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick} className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-sun px-[18px] text-sm font-bold text-ink">
      <span aria-hidden="true" className={`inline-block text-lg leading-none transition-transform duration-[350ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "rotate-45" : ""}`}>
        +
      </span>
      {label}
    </button>
  );
}

/** A section's title, short explanation and (optionally) its "+ Add" button. */
export function SectionTop({ title, intro, add }: { title: string; intro: ReactNode; add?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <h2 className="text-[21px] font-semibold">{title}</h2>
        <p className="max-w-[64ch] text-[13.5px] leading-normal text-ink-soft">{intro}</p>
      </div>
      {add}
    </div>
  );
}

/** The form a "+ Add" button opens: slides open under the header. */
export function AddForm({ open, onSubmit, children }: { open: boolean; onSubmit: () => void; children: ReactNode }) {
  return (
    <Collapse open={open}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mb-1 flex flex-wrap items-center gap-2.5 rounded-[22px] bg-mint p-3.5"
      >
        {children}
      </form>
    </Collapse>
  );
}

/** Cancel and the main button of an add form, kept together on the right. */
export function FormButtons({ cancel, submit, onCancel, disabled }: { cancel: string; submit: string; onCancel: () => void; disabled?: boolean }) {
  return (
    <span className="flex flex-1 justify-end gap-2">
      <button type="button" onClick={onCancel} className="min-h-11 rounded-full bg-surface px-4 text-sm font-semibold">
        {cancel}
      </button>
      <button type="submit" disabled={disabled} className="min-h-11 whitespace-nowrap rounded-full bg-sun px-4 text-sm font-bold text-ink disabled:opacity-50">
        {submit}
      </button>
    </span>
  );
}

const RowContext = createContext<() => HTMLElement | null>(() => null);
/** The row element (for shrinking it away), from inside a row's panel. */
export const useRowElement = () => useContext(RowContext);

/**
 * A row that opens to show its settings. Closed it is one line; open, its panel slides out under
 * it. New rows (`fresh`) grow into place with a fading teal outline.
 */
export function SettingsRow({
  id,
  fresh = false,
  open,
  onToggle,
  openLabel,
  lead,
  title,
  subtitle,
  badges,
  muted = false,
  action,
  children,
}: {
  id: string;
  fresh?: boolean;
  open: boolean;
  onToggle?: () => void;
  openLabel: string;
  lead?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  muted?: boolean;
  /** Something at the end of a row that has no panel (e.g. Archive). */
  action?: ReactNode;
  children?: ReactNode;
}) {
  const ref = useGrowIn<HTMLDivElement>(fresh);
  const panelId = `row-panel-${id}`;
  const opens = !!children && !!onToggle;
  return (
    <RowContext.Provider value={() => ref.current}>
      <div ref={ref} data-row data-id={id} className={`relative rounded-[20px] transition-colors duration-300 ${open ? "bg-mint" : "bg-mint-soft"}`}>
        <div className={`flex min-h-[62px] items-center gap-3 px-3 py-2.5 transition-opacity duration-300 ${muted ? "opacity-70" : ""}`}>
          {lead}
          {opens ? (
            <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-[15px] font-semibold">{title}</span>
              {subtitle && <span className="truncate text-[12.5px] text-muted">{subtitle}</span>}
            </button>
          ) : (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold">{title}</span>
              {subtitle && <span className="truncate text-[12.5px] text-muted">{subtitle}</span>}
            </span>
          )}
          {badges && <span className="hidden flex-wrap items-center justify-end gap-1.5 empty:hidden sm:flex">{badges}</span>}
          {action}
          {opens && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={openLabel}
              aria-expanded={open}
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "rotate-180 bg-surface" : ""}`}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
        {badges && <div className="-mt-1.5 flex flex-wrap gap-1.5 px-3 pb-2.5 empty:hidden sm:hidden">{badges}</div>}
        {children && (
          <Collapse open={open}>
            <div id={panelId} className="flex flex-col gap-3.5 px-3.5 pb-3.5 sm:pl-[58px]">
              {children}
            </div>
          </Collapse>
        )}
      </div>
    </RowContext.Provider>
  );
}

const BADGES = { teal: "bg-teal-tint text-teal-deep", green: "bg-leaf-tint text-leaf-ink", sun: "bg-sun-tint text-sun-ink", grey: "bg-surface text-ink-soft", red: "bg-danger/10 text-danger" };
export function Badge({ tone, children }: { tone: keyof typeof BADGES; children: ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold ${BADGES[tone]}`}>{children}</span>;
}

/** One line of a row's panel: a small label on the left, the controls beside it. */
export function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="w-full text-xs font-bold uppercase tracking-wider text-muted sm:w-[100px] sm:shrink-0">{label}</span>
      {children}
    </div>
  );
}

/** A box with its language tag (AZ / EN) in front. */
export function Lang({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-[1_1_220px] items-center gap-2">
      <span aria-hidden="true" className="rounded-md bg-surface px-1.5 py-0.5 text-[10.5px] font-extrabold text-muted">
        {tag}
      </span>
      {children}
    </span>
  );
}

/** A text box that saves when you leave it or press Enter (Escape puts the saved text back). */
export function SavedInput({ value, label, placeholder, required = false, max = 60, type = "text", mono = false, onSave }: { value: string; label: string; placeholder?: string; required?: boolean; max?: number; type?: "text" | "date"; mono?: boolean; onSave: (next: string) => void }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  const commit = (next = text.trim()) => {
    if (next === value || (required && !next)) return setText(value);
    onSave(next);
  };
  return (
    <input
      type={type}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      maxLength={type === "text" ? max : undefined}
      onChange={(e) => {
        setText(e.target.value);
        // A date picker has no "leaving" moment on phones: save as soon as a whole date is chosen.
        if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) commit(e.target.value);
      }}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setText(value);
      }}
      className={`${inputCls} h-10 ${type === "date" ? "w-auto" : "flex-1"} ${mono ? "font-mono text-sm" : ""}`}
    />
  );
}

/**
 * The bottom of a row's panel: a note on the left and one action on the right. With `confirm`,
 * the action first turns into a yellow "are you sure?" bar.
 */
export function RowFoot({
  note,
  label,
  tone = "danger",
  confirm,
  confirmLabel,
  cancelLabel,
  onDo,
}: {
  note?: ReactNode;
  label?: string;
  tone?: "danger" | "sun";
  confirm?: string;
  confirmLabel?: string;
  cancelLabel: string;
  onDo?: (row: HTMLElement | null) => void;
}) {
  const row = useRowElement();
  const [asking, setAsking] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (asking) popIn(bar.current);
  }, [asking]);
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2.5 border-t border-line-strong pt-3">
      {asking && confirm ? (
        <div ref={bar} className="flex-1">
          <ConfirmBar text={confirm} confirmLabel={confirmLabel ?? label ?? ""} cancelLabel={cancelLabel} onCancel={() => setAsking(false)} onConfirm={() => onDo?.(row())} />
        </div>
      ) : (
        <>
          <span className="flex-[1_1_220px] text-[12.5px] text-muted">{note}</span>
          {label && onDo && (
            <button
              type="button"
              onClick={() => (confirm ? setAsking(true) : onDo(row()))}
              className={`min-h-10 rounded-full px-4 text-[13px] font-bold ${tone === "danger" ? "bg-danger/10 text-danger" : "bg-sun text-ink"}`}
            >
              {label}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** A group that folds away (deactivated people, archived types, past days), shown only when it has rows. */
export function Group({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const countRef = useRef<HTMLSpanElement>(null);
  const last = useRef(count);
  useEffect(() => {
    if (count > last.current && !open && countRef.current && !prefersReducedMotion())
      countRef.current.animate([{ transform: "scale(1.15)", color: "var(--color-teal)" }, { transform: "none" }], { duration: 600, easing: BOUNCY() });
    last.current = count;
  }, [count, open]);
  return (
    <Collapse open={count > 0}>
      <div className="flex flex-col">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 text-left text-[13.5px] font-bold text-ink-soft">
          <span className={`flex size-[26px] items-center justify-center rounded-full text-muted transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "rotate-180" : ""}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <span ref={countRef} className="inline-block">
            {label}
          </span>
        </button>
        <Collapse open={open}>
          <div className="flex flex-col gap-2.5 pt-1.5">{children}</div>
        </Collapse>
      </div>
    </Collapse>
  );
}

/** Colour swatches with a ring that glides to the chosen one. */
export function ColorSwatches({ colors, value, label, names, onChange }: { colors: readonly string[]; value: string; label: string; names: string[]; onChange: (color: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const placed = useRef<number | null>(null);
  useLayoutEffect(() => {
    const target = box.current?.querySelector<HTMLElement>(`[data-color="${value}"]`);
    const el = ring.current;
    if (!target || !el) return;
    const left = target.offsetLeft - 4;
    if (placed.current !== null && placed.current !== left && !prefersReducedMotion())
      el.animate([{ transform: `translateX(${placed.current - left}px)` }, { transform: "none" }], { duration: 460, easing: BOUNCY() });
    el.style.left = `${left}px`;
    el.style.opacity = "1";
    placed.current = left;
  }, [value]);
  return (
    <div ref={box} role="group" aria-label={label} className="relative flex flex-wrap gap-2 py-1">
      {colors.map((color, i) => (
        <button
          key={color}
          type="button"
          data-color={color}
          aria-label={names[i]}
          title={names[i]}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className="size-[30px] rounded-full transition-transform duration-200 hover:scale-110"
          style={{ background: color }}
        />
      ))}
      <span ref={ring} aria-hidden="true" className="pointer-events-none absolute top-0 size-[38px] rounded-full border-[2.5px] border-ink opacity-0" />
    </div>
  );
}

/** An access code: dots, or the characters blurring into view one after another. */
export function CodeReveal({ code, hiddenLabel }: { code: string | null; hiddenLabel: string }) {
  return (
    <span aria-label={code ? undefined : hiddenLabel} className="inline-flex min-w-[150px] select-all rounded-xl bg-surface px-3.5 py-2 font-mono text-[17px] font-semibold tracking-[0.12em]">
      {code ? (
        <span key={code} data-code={code}>
          {[...code].map((ch, i) => (
            <span key={i} className="zk-char inline-block" style={{ animationDelay: `${i * 35}ms` }}>
              {ch}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-ink-soft">••••••••</span>
      )}
    </span>
  );
}

/** A round button that copies; its icon turns into a tick for a moment. */
export function CopyButton({ label, onCopy }: { label: string; onCopy: () => Promise<boolean> }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        if (!(await onCopy())) return;
        setDone(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1600);
      }}
      className={`flex size-10 items-center justify-center rounded-full bg-surface transition-colors ${done ? "text-teal" : "text-ink-soft"}`}
    >
      <span key={String(done)} className="zk-pop flex">
        {done ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m5 12 5 5 9-10" />
          </svg>
        ) : (
          <Icon name="copy" size={18} />
        )}
      </span>
    </button>
  );
}

/** The task type's icon as a button; opens a grid of the icons to choose from (saves at once). */
export function IconPicker({ value, label, title, names, onChange }: { value: TaskIcon; label: string; title: string; names: Record<TaskIcon, string>; onChange: (icon: TaskIcon) => void }) {
  const [open, setOpen] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    // Keep it on the screen: on a phone it slides left when it would stick out on the right.
    el.style.left = "0px";
    const r = el.getBoundingClientRect();
    // The page's own width (on phones, innerWidth can include what sticks out).
    const over = r.right - (document.documentElement.clientWidth - 12);
    if (over > 0) el.style.left = `${-Math.min(over, r.left - 12)}px`;
    popIn(el, "translateY(-6px) scale(0.96)");
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex size-11 items-center justify-center rounded-[14px] border-[1.5px] bg-surface text-teal-deep transition-shadow ${open ? "border-teal shadow-[0_0_0_3px_var(--color-teal-tint)]" : "border-transparent"}`}
      >
        <span key={value} className="zk-pop flex">
          <TaskTypeIcon name={value} size={22} />
        </span>
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-ink text-surface">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </span>
      </button>
      {open && (
        <div ref={pop} role="group" aria-label={title} className="absolute left-0 top-[52px] z-20 w-[min(356px,calc(100vw-56px))] rounded-[20px] bg-surface p-3 shadow-[0_16px_44px_rgba(24,35,47,0.22)]">
          <div className="mx-1 mb-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
          <div className="grid grid-cols-6 gap-1.5">
            {TASK_ICON_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={names[name]}
                title={names[name]}
                aria-pressed={name === value}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={`flex h-[46px] items-center justify-center rounded-xl transition-colors ${name === value ? "bg-teal text-white" : "bg-mint-soft text-ink-soft hover:bg-mint"}`}
              >
                <TaskTypeIcon name={name} size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
