"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/spring";

const PIN = "M12 17v5M9 10.8V5h6v5.8l2.6 2.7c.3.3.4.6.4 1V15H6v-.5c0-.4.1-.7.4-1zM8 5h8";

export function PinIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={PIN} />
    </svg>
  );
}

/**
 * The note on a task's content ID, in a soft strip under the content ID. Long notes show two
 * lines and "More", which opens the rest smoothly ("Less" folds it back).
 */
export function ContentNoteStrip({ note, label, more, less }: { note: string; label: string; more: string; less: string }) {
  const text = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const from = useRef<number | null>(null);

  // Whether it is cut off at two lines (checked again when the card gets narrower or wider).
  useLayoutEffect(() => {
    const el = text.current;
    if (!el) return;
    const check = () => {
      if (!open) setLong(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [note, open]);

  // Opening or closing: its height eases from the old size to the new one.
  useLayoutEffect(() => {
    const el = text.current;
    const start = from.current;
    from.current = null;
    if (!el || start === null || prefersReducedMotion()) return;
    const end = el.offsetHeight;
    if (Math.abs(end - start) < 1) return;
    el.animate([{ height: `${start}px`, overflow: "hidden" }, { height: `${end}px`, overflow: "hidden" }], { duration: 380, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });
  }, [open]);

  return (
    <div role="note" aria-label={label} className="flex items-start gap-2 rounded-xl bg-surface/60 px-2.5 py-[7px] text-[13px] leading-[1.45] text-ink-body">
      <PinIcon className="mt-0.5 text-sun-ink" />
      <p ref={text} className={`min-w-0 flex-1 whitespace-pre-line [overflow-wrap:anywhere] ${open ? "" : "line-clamp-2"}`}>
        {note}
      </p>
      {(long || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            from.current = text.current?.offsetHeight ?? null;
            setOpen((v) => !v);
          }}
          className="-my-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[13px] font-bold text-teal-deep hover:bg-surface"
        >
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
