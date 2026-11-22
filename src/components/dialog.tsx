"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A pop-up window over the page. Closes with Escape or a click on the dimmed background. */
export function Dialog({ label, onClose, children, wide = false }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);
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
