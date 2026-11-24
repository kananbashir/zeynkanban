"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

// Animations for lists that grow and shrink: a new row grows into place with a teal outline that
// fades, a removed row shrinks away while the rows below glide up, and a message offers Undo.
// With "reduce motion" switched on, rows simply appear and disappear.

/** Rows come and go easing in and out (slow start, slow finish), like the opening and closing panels. */
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

/**
 * The slot a row takes in its list: the row itself, or the list item around it (a sortable row's
 * wrapper). Its share of the list's gap is animated too, so nothing jumps when it appears or goes.
 */
function slotOf(el: HTMLElement) {
  const item = el.closest<HTMLElement>("[data-list-item]") ?? el;
  const list = item.parentElement;
  const gap = list ? parseFloat(getComputedStyle(list).rowGap) || 0 : 0;
  // The gap sits after the row, or before it when it is the last one.
  const side = item.nextElementSibling ? "marginBottom" : "marginTop";
  return { item, gap: item.previousElementSibling || item.nextElementSibling ? gap : 0, side } as const;
}

/** A new row: its slot opens from nothing (gap included) while it fades in; then a teal outline fades out. */
export function growIn(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;
  const { item, gap, side } = slotOf(el);
  const h = item.offsetHeight;
  item.animate(
    [
      { height: "0px", opacity: 0, [side]: `${-gap}px`, transform: "translateY(-6px) scale(0.985)", overflow: "hidden" },
      { height: `${h}px`, opacity: 1, [side]: "0px", transform: "none", overflow: "hidden" },
    ],
    { duration: 440, easing: EASE_IN_OUT },
  );
  // The outline only once the row has its full size, so it never looks squashed.
  el.animate([{ boxShadow: "inset 0 0 0 2.5px transparent" }, { boxShadow: "inset 0 0 0 2.5px var(--color-teal)", offset: 0.3 }, { boxShadow: "inset 0 0 0 2.5px var(--color-teal)", offset: 0.6 }, { boxShadow: "inset 0 0 0 2.5px transparent" }], { duration: 1500, delay: 380 });
}

/** A removed row: its slot closes to nothing (gap included) while it fades; `done` runs when it is gone. */
export function shrinkOut(el: HTMLElement | null, done: () => void) {
  if (!el || prefersReducedMotion()) return done();
  const { item, gap, side } = slotOf(el);
  const h = item.offsetHeight;
  item.style.pointerEvents = "none";
  const a = item.animate(
    [
      { height: `${h}px`, opacity: 1, [side]: "0px", transform: "none", overflow: "hidden" },
      { height: "0px", opacity: 0, [side]: `${-gap}px`, transform: "scale(0.985)", overflow: "hidden" },
    ],
    { duration: 380, easing: EASE_IN_OUT, fill: "forwards" },
  );
  a.onfinish = () => {
    done();
    // Stay folded until the row has actually left the page: some browsers (Safari) draw a frame
    // before the page has removed it, and letting go then would flash the whole row back for an
    // instant. If it is still there after a few frames, the slot was reused: let it go back to normal.
    let frames = 0;
    const settle = () => {
      if (!item.isConnected) return;
      if (++frames < 10) return void requestAnimationFrame(settle);
      a.cancel();
      item.style.pointerEvents = "";
    };
    requestAnimationFrame(settle);
  };
}

/** Runs growIn once, when the row first appears, if `fresh` (e.g. just added or brought back by Undo). */
export function useGrowIn<T extends HTMLElement>(fresh: boolean) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (fresh) growIn(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

type Offer = { id: number; text: string; undoLabel: string; undo?: () => void };

/** A dark message at the bottom with an optional "Undo" button, for about 5 seconds. */
export function useUndoToast() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, undoLabel: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setOffer({ id: Date.now(), text, undoLabel, undo });
    timer.current = setTimeout(() => setOffer(null), 5000);
  }, []);
  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOffer(null);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { offer, show, close };
}

export function UndoToast({ offer, onClose }: { offer: Offer | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (offer && ref.current && !prefersReducedMotion())
      ref.current.animate([{ transform: "translateY(24px) scale(0.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 520, easing: springOrFallback(420, 26, 0.62) });
  }, [offer?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center lg:bottom-6">
      {offer && (
        <div ref={ref} key={offer.id} className="pointer-events-auto flex max-w-[560px] items-center gap-3.5 rounded-full bg-ink py-2 pl-[18px] pr-2 text-sm font-medium text-surface shadow-[0_12px_32px_rgba(24,35,47,0.25)]">
          <span className="py-1.5">{offer.text}</span>
          {offer.undo && (
            <button
              type="button"
              onClick={() => {
                offer.undo?.();
                onClose();
              }}
              className="rounded-full bg-surface/15 px-3.5 py-2 font-semibold"
            >
              {offer.undoLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
