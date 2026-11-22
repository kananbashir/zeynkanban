"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

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

  const pillColor = tone === "teal" ? "bg-teal" : "bg-white shadow-[0_1px_3px_rgba(24,35,47,0.14)]";
  const activeText = tone === "teal" ? "text-white" : "text-ink";
  const idleText = tone === "teal" ? "text-icon" : "text-ink-soft";

  return (
    <div ref={box} role="group" aria-label={label} className={`relative flex gap-1 rounded-full p-1 ${tone === "teal" ? "bg-white" : "bg-mint"} ${className}`}>
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
export function SlideByDate({ date, children, className = "" }: { date: string; children: ReactNode; className?: string }) {
  const [direction, setDirection] = useState<"" | "zk-next" | "zk-prev">("");
  const [shown, setShown] = useState(date);
  if (shown !== date) {
    // `shown` still holds the previous date here, so it tells the direction.
    setDirection(date > shown ? "zk-next" : "zk-prev");
    setShown(date);
  }
  return (
    <span key={date} className={`inline-block ${direction} ${className}`}>
      {children}
    </span>
  );
}

/**
 * Animates the items inside a container (marked with data-flip="id") when they move:
 * a card that changes place glides from where it was; a new card fades in.
 */
export function useFlip(container: RefObject<HTMLElement | null>) {
  const previous = useRef(new Map<string, { x: number; y: number }>());
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
