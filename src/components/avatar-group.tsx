"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { initials } from "./top-bar";

export type GroupPerson = { id: string; name: string };

const AVATARS = ["#0b7f7b", "#5b4bc4", "#b4532a", "#1f6fb2", "#8a4b9c", "#4e6b1f"];
export function personColor(id: string) {
  let sum = 0;
  for (const ch of id) sum = (sum + ch.charCodeAt(0)) % 997;
  return AVATARS[sum % AVATARS.length];
}

const RISE = "-30%"; // how far a hovered avatar rises
const RISE_MS = 620; // spring 300/17: overshoots ~17%, then dips the same way on the way down
const TIP_MS = 420; // spring 400/29: glides a little past the next avatar before it settles
const EDGE = 4; // the label may start at most this far before the group

/**
 * Overlapping avatars of the people on a task (modelled on Animate UI's Avatar Group). The hovered,
 * focused or pressed avatar rises on a bouncy spring; one shared name label opens at once and glides
 * from avatar to avatar. With reduced motion, the avatar rises at once and the label only fades.
 */
export function AvatarGroup({ people, label, size = 28, max = 4, more }: { people: GroupPerson[]; label: string; size?: number; max?: number; more: (n: number) => string }) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  const box = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const easing = useMemo(() => (typeof window === "undefined" ? null : { rise: springOrFallback(300, 17, RISE_MS / 1000, "cubic-bezier(0.34, 1.8, 0.64, 1)"), tip: springOrFallback(400, 29, TIP_MS / 1000) }), []);
  const lastTip = useRef<{ left: number; arrow: number } | null>(null);
  const lastWidth = useRef(0); // the label's width when it was last placed

  const avatarAt = (i: number) => box.current?.querySelectorAll<HTMLElement>("[data-avatar]")[i] ?? null;

  const rise = (i: number, up: boolean) => {
    const el = avatarAt(i);
    if (!el || !easing) return;
    const running = el.getAnimations().filter((a) => a.id === "rise");
    const from = running.length ? getComputedStyle(el).translate : up ? "0 0" : `0 ${RISE}`;
    running.forEach((a) => a.cancel());
    const to = up ? `0 ${RISE}` : "0 0";
    el.style.translate = to === "0 0" ? "" : to;
    if (!prefersReducedMotion()) el.animate([{ translate: from === "none" ? "0 0" : from }, { translate: to }], { duration: RISE_MS, easing: easing.rise, id: "rise" });
  };

  // The shared label: open at once on the first avatar, then glide to the next one. It hangs from the
  // group's right edge, so a longer name grows to the left: grown to the right, even for a moment
  // before it is placed, it could stick out past the screen and a phone would zoom and scroll the page.
  // Positions below are its left edge from the group's start; `shift` turns one into its translate.
  useLayoutEffect(() => {
    const el = tip.current;
    if (!el || !easing) return;
    // Read how visible the label is before cancelling its fade: the fade holds that opacity, and
    // without it the label would blink out for a frame while gliding to the next avatar.
    const opacity = parseFloat(getComputedStyle(el).opacity) || 0;
    el.getAnimations().filter((a) => a.id === "tip-fade").forEach((a) => a.cancel());
    if (active === null) {
      el.animate([{ opacity }, { opacity: 0 }], { duration: 120, fill: "forwards", id: "tip-fade" });
      lastTip.current = null;
      return;
    }
    const avatar = avatarAt(active);
    const arrow = el.querySelector<HTMLElement>("[data-arrow]");
    if (!avatar || !arrow) return;
    // Centred over the avatar, but never sticking out past the start of the group (on a phone a
    // long name over the first avatar would run off the screen), nor past the right edge of the
    // screen or of its card (the group may sit at the right of a card). The arrow still points at the avatar.
    const centre = avatar.offsetLeft + avatar.offsetWidth / 2;
    const card = box.current?.closest("article")?.getBoundingClientRect().right ?? Infinity;
    const end = Math.min(document.documentElement.clientWidth - 8, card - 6);
    const room = end - (box.current?.getBoundingClientRect().left ?? 0) - el.offsetWidth;
    const left = Math.min(Math.max(-EDGE, centre - el.offsetWidth / 2), room);
    const to = { left, arrow: centre - left };
    const shift = (w: number) => (box.current?.offsetWidth ?? 0) - w;
    const moving = el.getAnimations().filter((a) => a.id === "tip-move");
    const was = moving.length ? { left: (parseFloat(getComputedStyle(el).translate) || 0) + shift(lastWidth.current), arrow: parseFloat(getComputedStyle(arrow).left) || 0 } : lastTip.current;
    // The new name may be longer: start the glide where it still fits on the screen, the arrow tip where it was.
    const from = was && was.left > room ? { left: room, arrow: was.arrow + was.left - room } : was;
    moving.forEach((a) => a.cancel());
    arrow.getAnimations().forEach((a) => a.cancel());
    const now = shift(el.offsetWidth);
    el.style.translate = `${to.left - now}px 0`;
    arrow.style.left = `${to.arrow}px`;
    if (from && !prefersReducedMotion()) {
      // Label and arrow move on the same spring, so the arrow tip travels straight from avatar to avatar.
      el.animate([{ translate: `${from.left - now}px 0` }, { translate: `${to.left - now}px 0` }], { duration: TIP_MS, easing: easing.tip, id: "tip-move" });
      arrow.animate([{ left: `${from.arrow}px` }, { left: `${to.arrow}px` }], { duration: TIP_MS, easing: easing.tip });
    }
    el.animate([{ opacity }, { opacity: 1 }], { duration: lastTip.current === null ? 90 : 60, fill: "forwards", id: "tip-fade" });
    lastTip.current = to;
    lastWidth.current = el.offsetWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Which avatar is up, kept in a ref too: a tap fires enter, press and focus right after each
  // other, before React re-renders, so the handlers must not read a stale `active`.
  const current = useRef<number | null>(null);
  const enter = (i: number) => {
    const was = current.current;
    if (was === i) return;
    if (was !== null) rise(was, false);
    rise(i, true);
    current.current = i;
    setActive(i);
  };
  const leave = () => {
    const was = current.current;
    if (was === null) return;
    rise(was, false);
    current.current = null;
    setActive(null);
  };

  // The group is left out of scroll anchoring: an avatar rising or the label growing upward must not
  // make the browser scroll the page to keep them in place (a tap would then land somewhere else).
  return (
    <div ref={box} role="group" aria-label={label} className="relative flex shrink-0 items-center [overflow-anchor:none] [&_*]:[overflow-anchor:none]" onPointerLeave={(e) => e.pointerType === "mouse" && leave()} onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && leave()}>
      {shown.map((p, i) => (
        <span
          key={p.id}
          data-avatar
          tabIndex={0}
          aria-label={p.name}
          onPointerEnter={(e) => e.pointerType === "mouse" && enter(i)}
          onFocus={() => enter(i)}
          // Touch: a tap shows the name, a second tap on the same avatar hides it (as does tapping elsewhere).
          onPointerDown={(e) => e.pointerType !== "mouse" && (current.current === i ? leave() : enter(i))}
          className="relative flex shrink-0 cursor-default items-center justify-center rounded-full border-2 border-surface font-bold text-white outline-offset-1"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: personColor(p.id), marginLeft: i ? -Math.round(size * 0.3) : 0, zIndex: shown.length - i }}
        >
          {initials(p.name)}
        </span>
      ))}
      {hidden > 0 && (
        <span
          className="relative flex shrink-0 items-center justify-center rounded-full border-2 border-surface bg-neutral-card font-bold text-ink-soft"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.34), marginLeft: -Math.round(size * 0.3), zIndex: 0 }}
          title={people.slice(max).map((p) => p.name).join(", ")}
        >
          +{hidden}
        </span>
      )}
      <span
        ref={tip}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[calc(100%+12px)] right-0 z-30 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-surface opacity-0 shadow-[0_6px_18px_rgba(24,35,47,0.22)]"
      >
        {active !== null ? shown[active]?.name : ""}
        <span data-arrow className="absolute top-full -ml-1 size-2 -translate-y-1 rotate-45 bg-ink" />
      </span>
      <span className="sr-only">{more(hidden)}</span>
    </div>
  );
}
