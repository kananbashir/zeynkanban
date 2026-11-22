"use client";

import { useEffect } from "react";

// The press animation of every button on the site, in one place (the same behaviour as Animate UI's
// Button): pressing scales a button to 0.97 on a spring (stiffness 550, damping 30: quick, with a
// slight overshoot) and lets it spring back on release. Nothing happens on hover, nothing for
// disabled buttons, and nothing when the person prefers reduced motion. Links that look like buttons
// get it too; plain text links don't change, since scaling has no effect on inline text.
// Add data-no-press to an element to leave it out.

export const TAP_SCALE = 0.97;
const STIFFNESS = 550;
const DAMPING = 30;
const DURATION = 350; // ms: long enough for the spring to settle
const PRESSABLE = 'button, a[href], [role="button"], summary';

/** The spring as a CSS easing curve: the motion of a mass on a spring, sampled every few milliseconds. */
export function springEasing(stiffness = STIFFNESS, damping = DAMPING, duration = DURATION / 1000, steps = 40): string {
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    let p: number;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      p = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    } else {
      p = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    }
    points.push(i === steps ? "1" : p.toFixed(4));
  }
  return `linear(${points.join(", ")})`;
}

export function PressAnimation() {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const easing = CSS.supports("animation-timing-function", "linear(0, 1)") ? springEasing() : "cubic-bezier(0.34, 1.56, 0.64, 1)";
    const pressed = new Set<HTMLElement>();

    const scaleTo = (el: HTMLElement, to: number) => {
      const running = el.getAnimations().filter((a) => a.id === "zk-press");
      const from = running.length ? parseFloat(getComputedStyle(el).scale) || 1 : 1; // start from where it is now
      running.forEach((a) => a.cancel());
      const animation = el.animate({ scale: [String(from), String(to)] }, { duration: DURATION, easing, fill: "forwards", id: "zk-press" });
      if (to === 1) animation.onfinish = () => animation.cancel();
    };

    const target = (node: EventTarget | null): HTMLElement | null => {
      const el = node instanceof Element ? node.closest<HTMLElement>(PRESSABLE) : null;
      if (!el || el.closest("[data-no-press]") || el.matches(':disabled, [aria-disabled="true"]')) return null;
      return el;
    };
    const press = (el: HTMLElement | null) => {
      if (!el || motion.matches || pressed.has(el)) return;
      pressed.add(el);
      scaleTo(el, TAP_SCALE);
    };
    const releaseAll = () => {
      pressed.forEach((el) => scaleTo(el, 1));
      pressed.clear();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) press(target(e.target));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.repeat && (e.key === "Enter" || e.key === " ")) press(target(e.target));
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", releaseAll, true);
    document.addEventListener("pointercancel", releaseAll, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", releaseAll, true);
    window.addEventListener("blur", releaseAll);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", releaseAll, true);
      document.removeEventListener("pointercancel", releaseAll, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", releaseAll, true);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);
  return null;
}
