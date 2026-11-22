"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type Segment = { key: string; label: ReactNode; href?: string; count?: number | string };

/**
 * A row of options with a pill that slides to the chosen one.
 * Options are buttons (onChange) or links (href), e.g. the tabs of a page.
 */
export function SegmentedControl({
  items,
  value,
  onChange,
  label,
  tone = "white",
  className = "",
  itemClassName = "min-h-10 px-3.5 text-sm",
  stretch = false,
}: {
  items: Segment[];
  value: string;
  onChange?: (key: string) => void;
  label: string;
  tone?: "white" | "teal";
  className?: string;
  itemClassName?: string;
  stretch?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number; animate: boolean } | null>(null);

  useLayoutEffect(() => {
    const container = box.current;
    if (!container) return;
    const measure = (animate: boolean) => {
      const active = container.querySelector<HTMLElement>(`[data-segment="${CSS.escape(value)}"]`);
      if (active) setPill((old) => ({ left: active.offsetLeft, width: active.offsetWidth, animate: animate && !!old && !reducedMotion() }));
    };
    measure(true);
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(container);
    return () => observer.disconnect();
  }, [value, items.length]);

  const pillColor = tone === "teal" ? "bg-teal" : "bg-surface shadow-[0_1px_3px_rgba(24,35,47,0.14)]";
  const activeText = tone === "teal" ? "text-white" : "text-ink";
  const idleText = tone === "teal" ? "text-icon" : "text-ink-soft";

  return (
    <div ref={box} role="group" aria-label={label} className={`relative flex gap-1 rounded-full p-1 ${tone === "teal" ? "bg-surface" : "bg-mint"} ${className}`}>
      {pill && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 top-1 rounded-full ${pillColor} ${pill.animate ? "transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]" : ""}`}
          style={{ width: pill.width, transform: `translateX(${pill.left - 4}px)`, left: 4 }}
        />
      )}
      {items.map((item) => {
        const on = item.key === value;
        const content = (
          <>
            <span>{item.label}</span>
            {item.count !== undefined && <span className={`font-medium ${on && tone === "teal" ? "text-teal-tint" : "text-muted"}`}>{item.count}</span>}
          </>
        );
        const cls = `relative z-[1] flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-200 ${stretch ? "flex-auto" : ""} ${on ? activeText : idleText} ${itemClassName}`;
        return item.href ? (
          <Link key={item.key} data-segment={item.key} href={item.href} scroll={false} aria-current={on ? "page" : undefined} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={item.key} data-segment={item.key} type="button" aria-pressed={on} onClick={() => onChange?.(item.key)} className={cls}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

/** Wraps content that changes with a date: it slides in from the right when moving forward and from the left when going back. */
export function SlideByDate({ date, children, block = false }: { date: string; children: ReactNode; block?: boolean }) {
  const [direction, setDirection] = useState<"" | "zk-next" | "zk-prev">("");
  const [shown, setShown] = useState(date);
  if (shown !== date) {
    // `shown` still holds the previous date here, so it tells the direction.
    setDirection(date > shown ? "zk-next" : "zk-prev");
    setShown(date);
  }
  return (
    <span key={date} className={`${block ? "block" : "inline-block"} ${direction}`}>
      {children}
    </span>
  );
}

/**
 * Animates the items inside a container (marked with data-flip="id") when they move:
 * a card that changes place glides from where it was; a new card fades in.
 * Positions are also kept up to date when the layout changes by itself (e.g. a card's notes open),
 * so only real moves animate, never a jump back to an old position.
 */
export function useFlip(container: RefObject<HTMLElement | null>) {
  const previous = useRef(new Map<string, { x: number; y: number }>());

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const origin = root.getBoundingClientRect();
        root.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
          if (node.getAnimations().length) return; // mid-glide: its stored end position is already right
          const rect = node.getBoundingClientRect();
          previous.current.set(node.dataset.flip!, { x: rect.left - origin.left, y: rect.top - origin.top });
        });
      });
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => observer.observe(node));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const reduce = reducedMotion();
    const next = new Map<string, { x: number; y: number }>();
    const hadItems = previous.current.size > 0;
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
      const id = node.dataset.flip!;
      const rect = node.getBoundingClientRect();
      const position = { x: rect.left - origin.left, y: rect.top - origin.top };
      next.set(id, position);
      if (reduce) return;
      const old = previous.current.get(id);
      if (old) {
        const dx = old.x - position.x;
        const dy = old.y - position.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
        }
      } else if (hadItems) {
        node.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" });
      }
    });
    previous.current = next;
  });
}

/**
 * Opens and closes its content by animating the height (and fading), instead of popping in and out.
 * The content stays mounted while it closes, then is removed (or kept, with keepMounted, e.g. for a
 * panel that is always open on wide screens: add `zk-collapse-lg-open`). While moving it clips its
 * content; once open it stops clipping, so focus outlines and shadows show in full.
 */
export function Collapse({
  open,
  children,
  className = "",
  appear = false,
  keepMounted = false,
  inertWhenClosed = false,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  appear?: boolean;
  keepMounted?: boolean;
  /** Make closed content unreachable by keyboard (only below the "lg" width when the panel is always open on wide screens). */
  inertWhenClosed?: boolean;
}) {
  const [mounted, setMounted] = useState(open || keepMounted);
  const [expanded, setExpanded] = useState(open && !appear);
  const [settled, setSettled] = useState(open && !appear);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setExpanded(true));
      const timer = setTimeout(() => setSettled(true), reducedMotion() ? 0 : 320);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
    const frame = requestAnimationFrame(() => {
      setSettled(false);
      setExpanded(false);
    });
    const timer = keepMounted ? 0 : setTimeout(() => setMounted(false), reducedMotion() ? 0 : 320);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [open, keepMounted]);
  if (!mounted) return null;
  return (
    <div data-open={expanded} data-settled={settled} inert={inertWhenClosed && !open ? true : undefined} className={`zk-collapse ${inertWhenClosed ? "zk-collapse-inert" : ""} ${className}`}>
      <div>{children}</div>
    </div>
  );
}

const WIDE = "(min-width: 1024px)";
/** True on wide screens (the "lg" layout), where side panels are always shown. */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    (change) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/** Glides the page so the element comes into view (instantly when the person prefers less motion). */
export function scrollIntoViewSoftly(element: HTMLElement | null, block: ScrollLogicalPosition = "start") {
  if (!element) return;
  requestAnimationFrame(() => element.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block }));
}
