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

const CAPTURE_EVENT = "zk-flip-capture";
/**
 * Notes where every gliding card is at this moment. Call it just before a change that moves cards
 * (outside React's own updates), so they glide from exactly where they are now.
 */
export function captureFlip() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CAPTURE_EVENT));
}

/** How far a card is shifted right now by a glide still running (0 when it is at rest). */
function shift(node: HTMLElement) {
  const t = getComputedStyle(node).transform;
  if (!t || t === "none") return { x: 0, y: 0 };
  const m = new DOMMatrixReadOnly(t);
  return { x: m.m41, y: m.m42 };
}

/**
 * Animates the items inside a container (marked with data-flip="id") when they move:
 * a card that changes place glides from where it was; a new card fades in.
 * Positions are kept as resting places (without any glide in progress) and are also kept up to
 * date when the layout changes by itself (e.g. a card's notes open), so only real moves animate.
 * A card that moves again while still gliding starts its new glide exactly where it is on screen.
 */
export function useFlip(container: RefObject<HTMLElement | null>) {
  const previous = useRef(new Map<string, { x: number; y: number }>());
  // The container's own height, so it can ease to its new size when cards move (what is below it
  // then follows smoothly instead of jumping when a group appears or goes).
  const height = useRef<number | null>(null);
  const resize = useRef<Animation | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let frame = 0;
    const record = () => {
      const origin = root.getBoundingClientRect();
      if (!resize.current) height.current = origin.height;
      root.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
        const rect = node.getBoundingClientRect();
        const moved = shift(node);
        previous.current.set(node.dataset.flip!, { x: rect.left - moved.x - origin.left, y: rect.top - moved.y - origin.top });
      });
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(record);
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => observer.observe(node));
    // Asked to note where everything is right now (just before cards move): see captureFlip.
    const capture = () => {
      cancelAnimationFrame(frame);
      record();
    };
    window.addEventListener(CAPTURE_EVENT, capture);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener(CAPTURE_EVENT, capture);
    };
  });

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    // Its height on screen now (mid-ease, if easing), then its real new height.
    const running = resize.current;
    const shownHeight = root.getBoundingClientRect().height;
    running?.cancel();
    resize.current = null;
    const fromHeight = running ? shownHeight : height.current;
    const origin = root.getBoundingClientRect();
    const reduce = reducedMotion();
    const next = new Map<string, { x: number; y: number }>();
    const hadItems = previous.current.size > 0;
    let moves = false;
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
      const id = node.dataset.flip!;
      const rect = node.getBoundingClientRect();
      const moved = shift(node); // a glide still running
      const position = { x: rect.left - moved.x - origin.left, y: rect.top - moved.y - origin.top };
      next.set(id, position);
      if (reduce) return;
      const old = previous.current.get(id);
      if (old) {
        // On screen it is at its old resting place plus whatever its running glide adds.
        const dx = old.x + moved.x - position.x;
        const dy = old.y + moved.y - position.y;
        if (Math.abs(old.x - position.x) > 1 || Math.abs(old.y - position.y) > 1) {
          moves = true;
          // Stop the glide still running (only glides: colour fades and CSS animations go on).
          node.getAnimations().forEach((a) => {
            if (!(a instanceof CSSTransition) && !(a instanceof CSSAnimation)) a.cancel();
          });
          node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
        }
      } else if (hadItems) {
        moves = true;
        node.animate([{ opacity: 0, transform: "scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" });
      }
    });
    if (previous.current.size > next.size) moves = true; // something left
    previous.current = next;
    const toHeight = origin.height;
    if (!reduce && moves && fromHeight !== null && Math.abs(fromHeight - toHeight) > 2) {
      const a = root.animate([{ height: `${fromHeight}px`, overflow: "clip" }, { height: `${toHeight}px`, overflow: "clip" }], { duration: 480, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      resize.current = a;
      a.onfinish = a.oncancel = () => {
        if (resize.current === a) resize.current = null;
      };
    }
    height.current = toHeight;
  });
}

/** How long a panel takes to open or close (matches the .zk-collapse transition in globals.css). */
const COLLAPSE_MS = 380;

/**
 * Opens and closes its content by animating the height (and fading), easing in and out, instead of
 * popping in and out. The content stays mounted while it closes, then is removed (or kept, with
 * keepMounted, e.g. for a panel that is always open on wide screens: add `zk-collapse-lg-open`).
 * While moving it clips its content; once open it stops clipping, so focus outlines and shadows show
 * in full. In a list with a gap, its share of the gap opens and closes with it, so nothing jumps.
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
  const box = useRef<HTMLDivElement>(null);
  // The gap the parent list puts next to this panel, and the panel's own margin on that side.
  const [gap, setGap] = useState<{ side: "marginTop" | "marginBottom"; size: number; base: number } | null>(null);
  if (open && !mounted) setMounted(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (!mounted || keepMounted || !el?.parentElement) return;
    const style = getComputedStyle(el.parentElement);
    const size = style.display.includes("flex") || style.display.includes("grid") ? parseFloat(style.rowGap) || 0 : 0;
    if (!size || (!el.previousElementSibling && !el.nextElementSibling)) return setGap(null);
    const side = el.previousElementSibling ? "marginTop" : "marginBottom";
    // Measure and place it with transitions off, so the starting point is already "closed"
    // (otherwise the browser would first animate from its plain margin and the gap would jump).
    el.style.transition = "none";
    el.style[side] = "";
    const base = parseFloat(getComputedStyle(el)[side]) || 0;
    el.style[side] = `${expanded ? base : -size}px`;
    void el.offsetHeight;
    el.style.transition = "";
    setGap({ side, size, base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, keepMounted]);
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setExpanded(true));
      const timer = setTimeout(() => setSettled(true), reducedMotion() ? 0 : COLLAPSE_MS);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
    const frame = requestAnimationFrame(() => {
      setSettled(false);
      setExpanded(false);
    });
    const timer = keepMounted ? 0 : setTimeout(() => setMounted(false), reducedMotion() ? 0 : COLLAPSE_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [open, keepMounted]);
  if (!mounted) return null;
  // Closed, it also takes back the list's gap (a negative margin), so opening and closing are seamless.
  // (Closed, gap + margin add up to nothing, exactly as when it is not there at all.)
  const style = gap ? { [gap.side]: `${expanded ? gap.base : -gap.size}px` } : undefined;
  return (
    <div
      ref={box}
      data-open={expanded}
      data-settled={settled}
      inert={inertWhenClosed && !open ? true : undefined}
      style={style}
      className={`zk-collapse ${inertWhenClosed ? "zk-collapse-inert" : ""} ${className}`}
    >
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
