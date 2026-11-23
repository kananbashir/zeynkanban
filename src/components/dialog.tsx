"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

/** Windows open right now, newest last: Escape closes only the one on top (e.g. a brief over a task window). */
const openWindows: object[] = [];
function track(me: object) {
  openWindows.push(me);
  return () => {
    const i = openWindows.lastIndexOf(me);
    if (i >= 0) openWindows.splice(i, 1);
  };
}
const onTop = (me: object) => openWindows[openWindows.length - 1] === me;

/** A pop-up window over the page. Closes with Escape or a click on the dimmed background. */
export function Dialog({ label, onClose, children, wide = false }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // The latest onClose, so the window is set up once when it opens (not again on every redraw,
  // which would move focus and change which window counts as on top).
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const me = {};
    const untrack = track(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTop(me) && close.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      untrack();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto p-2 sm:p-4">
      <button data-no-press type="button" aria-label="×" tabIndex={-1} onClick={onClose} className="fixed inset-0 cursor-default bg-scrim" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative my-4 flex w-full flex-col gap-4 rounded-[28px] bg-mint p-4 shadow-[0_24px_64px_rgba(24,35,47,0.3)] outline-none sm:my-6 sm:p-[22px] ${wide ? "max-w-[1080px]" : "max-w-[720px]"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

/**
 * A small "are you sure?" window in the middle of the screen. Focus starts on Cancel, so pressing
 * Enter by accident does nothing harmful; Escape or a click outside also cancels. It pops in on a
 * spring (just fades with reduced motion).
 */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending = false,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const cancelNow = useRef(onCancel);
  useLayoutEffect(() => {
    cancelNow.current = onCancel;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const me = {};
    const untrack = track(me);
    const onKey = (e: KeyboardEvent) => {
      if (!onTop(me)) return;
      if (e.key === "Escape") cancelNow.current();
      // Keep Tab inside the window.
      if (e.key === "Tab" && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        const first = items[0], last = items[items.length - 1];
        const target = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null;
        if (target) {
          e.preventDefault();
          target.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const still = prefersReducedMotion();
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    box.current?.animate(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }], { duration: still ? 150 : 420, easing: still ? "ease-out" : springOrFallback(420, 30, 0.42) });
    return () => {
      untrack();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div ref={scrim} aria-hidden="true" onClick={onCancel} className="fixed inset-0 bg-scrim" />
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        className="relative flex w-full max-w-[400px] flex-col gap-3 rounded-[28px] bg-surface p-6 shadow-[0_24px_64px_rgba(24,35,47,0.3)]"
      >
        <h2 id="confirm-title" className="text-xl font-semibold">{title}</h2>
        <p id="confirm-text" className="text-[15px] leading-relaxed text-ink-soft">{text}</p>
        <div className="mt-2 flex flex-wrap justify-end gap-2.5">
          <button ref={cancel} type="button" onClick={onCancel} className="min-h-12 rounded-full bg-mint px-5 text-[15px] font-semibold hover:bg-teal-tint">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className="min-h-12 rounded-full bg-danger px-5 text-[15px] font-semibold text-white disabled:opacity-60">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
