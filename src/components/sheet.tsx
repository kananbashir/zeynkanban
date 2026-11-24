"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { onTop, track } from "./dialog";

const noop = () => () => {};
const CloseContext = createContext<() => void>(() => {});
/** Closes the sheet this is inside (with its closing movement): for buttons in its header, body or footer. */
export const useSheetClose = () => useContext(CloseContext);
const isSheet = () => typeof window !== "undefined" && !window.matchMedia("(min-width: 640px)").matches;

/**
 * A window that pops up in the middle on a computer and slides up from the bottom on a phone
 * (where its top can be swiped down to close it). Escape, the dimmed background and useSheetClose()
 * (for buttons inside it) close it with the reverse movement, then call `onClose`.
 */
export function Sheet({
  label,
  onClose,
  header,
  footer,
  children,
  width = "sm:max-w-[720px]",
}: {
  label: string;
  onClose: () => void;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const done = useRef(onClose);
  useLayoutEffect(() => {
    done.current = onClose;
  });

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const el = panel.current;
    if (!el || prefersReducedMotion()) return done.current();
    const from = getComputedStyle(el).transform;
    const a = el.animate([{ transform: from === "none" ? "none" : from, opacity: 1 }, isSheet() ? { transform: "translateY(100%)", opacity: 1 } : { transform: "translateY(10px) scale(0.97)", opacity: 0 }], {
      duration: 260,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards",
    });
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
    a.onfinish = () => done.current();
  };
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  // For the header and footer buttons: a stable function that runs the latest close.
  const requestClose = useCallback(() => closeRef.current(), []);

  useLayoutEffect(() => {
    if (!inBrowser || prefersReducedMotion()) return;
    const sheet = isSheet();
    panel.current?.animate(sheet ? [{ transform: "translateY(100%)" }, { transform: "none" }] : [{ transform: "translateY(16px) scale(0.96)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: sheet ? 520 : 480,
      easing: springOrFallback(sheet ? 300 : 420, sheet ? 30 : 28, sheet ? 0.52 : 0.48),
    });
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [inBrowser]);

  useEffect(() => {
    if (!inBrowser) return;
    const me = {};
    const untrack = track(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTop(me) && closeRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      untrack();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [inBrowser]);

  // Swiping the sheet's top down closes it; let go early and it springs back.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isSheet() || e.pointerType === "mouse" || (e.target as HTMLElement).closest("button, a")) return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !panel.current) return;
    if (d.dy > 90) return close();
    const el = panel.current;
    el.animate([{ transform: `translateY(${d.dy}px)` }, { transform: "none" }], { duration: 320, easing: springOrFallback(420, 30, 0.32) });
    el.style.transform = "";
  };

  if (!inBrowser) return null;
  return createPortal(
    <CloseContext.Provider value={requestClose}>
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <div ref={scrim} aria-hidden="true" onClick={close} className="absolute inset-0 bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-mint shadow-[0_-12px_40px_rgba(24,35,47,0.25)] outline-none sm:max-h-[calc(100dvh-48px)] sm:rounded-[28px] sm:shadow-[0_24px_64px_rgba(24,35,47,0.3)] ${width}`}
      >
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="touch-none px-4 pb-3 pt-2.5 sm:touch-auto sm:px-[22px] sm:pt-[22px]">
          <div aria-hidden="true" className="mx-auto mb-2.5 h-[5px] w-11 rounded-full bg-line-strong sm:hidden" />
          {header}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-[22px]">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 sm:px-[22px] sm:pb-[18px]">{footer}</div>}
      </div>
    </div>
    </CloseContext.Provider>,
    document.body,
  );
}
