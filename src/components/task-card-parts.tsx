"use client";

import { Children, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/spring";

// Pieces of the task card: text cut to two lines with "… more", and the row of action buttons.

const NARROW = "(max-width: 639px)";
/** True on a phone-sized screen (below the "sm" width), where the card uses its small sizes. */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (change) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/**
 * Text shown on two lines; when it is longer, "… more" at the end of the second line opens the rest
 * (the height eases open), and "Less" after the text folds it again.
 */
export function ClampText({ text, more, less, icon, className = "" }: { text: string; more: string; less: string; icon?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const box = useRef<HTMLParagraphElement>(null);
  const from = useRef<number | null>(null);

  // Whether the text needs more than two lines (checked again when the card's width changes).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || open) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, text]);

  useLayoutEffect(() => {
    const el = box.current;
    const start = from.current;
    from.current = null;
    if (!el || start === null || prefersReducedMotion()) return;
    const end = el.offsetHeight;
    if (Math.abs(end - start) < 1) return;
    el.animate([{ height: `${start}px`, overflow: "hidden" }, { height: `${end}px`, overflow: "hidden" }], { duration: 380, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });
  }, [open]);

  const toggle = () => {
    from.current = box.current?.offsetHeight ?? null;
    setOpen((v) => !v);
  };

  return (
    <div className={`flex items-start ${className}`}>
      {icon}
      <p ref={box} className={`relative min-w-0 flex-1 whitespace-pre-line [overflow-wrap:anywhere] ${open ? "" : "line-clamp-2"}`}>
        {text}
        {open ? (
          <>
            {" "}
            <button type="button" aria-expanded onClick={toggle} className="inline font-bold text-teal-deep">
              {less} <span aria-hidden="true">⌃</span>
            </button>
          </>
        ) : (
          long && (
            <button type="button" aria-expanded={false} onClick={toggle} className="absolute bottom-0 right-0 bg-[linear-gradient(to_right,transparent,var(--panel)_28px)] pl-7 font-bold text-teal-deep max-sm:pl-[18px]">
              … {more.toLocaleLowerCase("az")}
            </button>
          )
        )}
      </p>
    </div>
  );
}

/**
 * The card's action buttons. On a wide screen, one row. Below that, a grid of two: one button
 * spans the row, three put the last one across the row; and when any label would not fit on one
 * line in half the width, they stack one per row, full width.
 */
export function ActionButtons({ children, grid }: { children: ReactNode; grid: boolean }) {
  const items = Children.toArray(children).filter(Boolean);
  const box = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !grid) return setStack(false);
    const check = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const half = (el.clientWidth - gap) / 2;
      // Each button's label at its natural width (it never wraps while measured), plus the button's padding.
      const tooWide = [...el.querySelectorAll<HTMLElement>("[data-fit]")].some((label) => {
        const button = label.parentElement!;
        const style = getComputedStyle(button);
        return label.scrollWidth + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) > half + 0.5;
      });
      setStack(tooWide);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [grid, items.length]);

  if (!items.length) return null;
  const layout = !grid ? "flex flex-wrap" : stack || items.length === 1 ? "grid grid-cols-1" : `grid grid-cols-2 ${items.length === 3 ? "[&>*:last-child]:col-span-2" : ""}`;
  return (
    <div ref={box} className={`zk-panel gap-2 rounded-[16px] p-3.5 max-sm:gap-[5px] max-sm:rounded-[13px] max-sm:p-2 ${layout}`}>
      {items}
    </div>
  );
}

/** A button of the card's action row; `children` is its label (with an icon), kept on one line where it fits. */
export function cardButtonClass(kind: "dark" | "leaf" | "dashed") {
  const look =
    kind === "dark"
      ? "bg-ink text-surface"
      : kind === "leaf"
        ? "bg-leaf text-white"
        : "border-[1.5px] border-dashed border-ink/35 bg-surface/50 font-semibold text-ink hover:bg-surface";
  return `flex min-h-[42px] min-w-0 items-center justify-center rounded-xl px-4 text-center text-[13.5px] font-bold leading-tight max-sm:min-h-7 max-sm:rounded-lg max-sm:px-1.5 max-sm:text-[10px] ${look}`;
}

/**
 * Whether a row of two parts (Notes, then the people: a name and avatars) should stack because the
 * people would not fit beside Notes at their full width. Measured again when the row's width changes.
 */
export function useStackWhenTight(row: RefObject<HTMLElement | null>): boolean {
  const [stack, setStack] = useState(false);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const check = () => {
      const [first, second] = [...el.children] as HTMLElement[];
      if (!first || !second) return setStack(false);
      const style = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || 0;
      // The people at full width: every part at its natural size (a cut name counts in full).
      const inner = getComputedStyle(second);
      const parts = [...second.children] as HTMLElement[];
      const people = parts.reduce((sum, p) => sum + p.scrollWidth, 0) + (parseFloat(inner.columnGap) || 0) * Math.max(0, parts.length - 1);
      setStack(first.offsetWidth + gap + people > room + 0.5);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [row]);
  return stack;
}
