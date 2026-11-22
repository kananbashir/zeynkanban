"use client";

import { useActionState, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { login, type LoginState } from "./actions";

const LENGTH = 8;
const INITIAL: LoginState = { error: null };

// How the code boxes move (modelled on Animate UI's Input OTP):
const LAND = 50; // a typed character lands small and faint, and grows into place this many ms later
const STAGGER = 50; // pasted or autofilled characters, and characters of a cleared code, follow each other by this much
const WAVE_STEP = 40; // a completed code sends a wave through the boxes, one box after another
const GROW_MS = 320; // spring 500/45: never goes past full size, mostly in by ~175ms
const RING_MS = 360; // spring 500/40, like the highlights elsewhere
const CHAR_TEXT = "font-mono text-lg font-medium md:text-[22px]";
const WAVE: Keyframe[] = [
  { translate: "0 0", easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
  { translate: "0 -4px", offset: 0.3 },
  { translate: "0 0" },
];

export function LoginForm({ t }: { t: Dictionary["login"] }) {
  const [state, action, pending] = useActionState(login, INITIAL);
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editedSinceError, setEditedSinceError] = useState(false);
  const [help, setHelp] = useState(false);

  const error = state.error && !editedSinceError ? state.error : null;
  const ready = code.length === LENGTH;
  const activeIndex = Math.min(code.length, LENGTH - 1);

  const box = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const ghosts = useRef<HTMLSpanElement>(null);
  const previous = useRef(code);
  const leaving = useRef(new Map<number, { scale: number; opacity: number }>());
  const easing = useMemo(
    () => (typeof window === "undefined" ? null : { grow: springOrFallback(500, 45, GROW_MS / 1000), ring: springOrFallback(500, 40, RING_MS / 1000), wave: springOrFallback(500, 20, 0.32) }),
    [],
  );
  const slots = () => Array.from(box.current?.querySelectorAll<HTMLElement>("[data-slot]") ?? []);
  const charOf = (i: number) => slots()[i]?.querySelector<HTMLElement>("[data-char]") ?? null;

  /** Moves the ring to a box: gliding on its spring, or at once. */
  const placeRing = (index: number, delay: number, glide: boolean) => {
    const el = ring.current;
    const slot = slots()[index];
    if (!el || !slot) return;
    el.style.width = `${slot.offsetWidth}px`;
    el.style.height = `${slot.offsetHeight}px`;
    const moving = el.getAnimations().filter((a) => a.id === "ring-move");
    const from = moving.length ? getComputedStyle(el).translate : el.style.translate;
    moving.forEach((a) => a.cancel());
    const to = `${slot.offsetLeft}px ${slot.offsetTop}px`;
    el.style.translate = to;
    if (glide && from && from !== to && easing && !prefersReducedMotion()) {
      el.animate([{ translate: from }, { translate: to }], { duration: RING_MS, delay, easing: easing.ring, fill: "backwards", id: "ring-move" });
    }
  };

  /** A copy of a removed character, left where it was, that animates away. */
  const ghost = (index: number, text: string, how: "delete" | "clear", delay: number) => {
    const layer = ghosts.current;
    const slot = slots()[index];
    if (!layer || !slot) return;
    const reduce = prefersReducedMotion();
    if (how === "delete" && reduce) return;
    const copy = document.createElement("span");
    copy.textContent = text;
    copy.className = `absolute flex items-center justify-center text-ink ${CHAR_TEXT}`;
    Object.assign(copy.style, { left: `${slot.offsetLeft}px`, top: `${slot.offsetTop}px`, width: `${slot.offsetWidth}px`, height: `${slot.offsetHeight}px` });
    layer.appendChild(copy);
    const start = leaving.current.get(index) ?? { scale: 1, opacity: 1 };
    const animation =
      how === "delete"
        ? copy.animate([{ scale: String(start.scale), opacity: start.opacity }, { scale: "0.5", opacity: 0 }], { duration: 150, easing: "ease-out", fill: "forwards" })
        : copy.animate(
            [
              { opacity: start.opacity, translate: "0 0", filter: "blur(0px)" },
              { opacity: 0, translate: reduce ? "0 0" : "0 6px", filter: "blur(4px)" },
            ],
            { duration: 260, delay, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "both" },
          );
    animation.onfinish = () => copy.remove();
  };

  // Remember how far each disappearing character had grown, so its copy leaves from there.
  const noteLeaving = (next: string) => {
    leaving.current.clear();
    for (let i = next.length; i < code.length; i++) {
      const el = charOf(i);
      if (!el) continue;
      const style = getComputedStyle(el);
      leaving.current.set(i, { scale: parseFloat(style.scale) || 1, opacity: parseFloat(style.opacity) || 1 });
    }
  };

  // React to each change of the code: new characters grow in, removed ones leave, the ring follows,
  // and a completed code sends a wave through the boxes.
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = code;
    if (before === code || !easing) return;
    const reduce = prefersReducedMotion();
    let same = 0;
    while (same < before.length && same < code.length && before[same] === code[same]) same++;
    const added = code.length - same;
    const removed = before.length - same;
    const shown = (ch: string) => (show ? ch : "•");

    for (let k = 0; k < added; k++) {
      const el = charOf(same + k);
      if (!el) continue;
      el.getAnimations().forEach((a) => a.cancel());
      if (reduce) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      else el.animate([{ scale: "0.7", opacity: 0.35 }, { scale: "1", opacity: 1 }], { duration: GROW_MS, delay: LAND + (added > 1 ? k * STAGGER : 0), easing: easing.grow, fill: "backwards" });
    }
    if (added === 0 && same === code.length) {
      if (removed === 1) ghost(same, shown(before[same]), "delete", 0);
      else for (let k = 0; k < removed; k++) ghost(before.length - 1 - k, shown(before[before.length - 1 - k]), "clear", k * STAGGER);
    }

    const landed = added > 0 ? LAND + (added > 1 ? (added - 1) * STAGGER : 0) : removed > 1 ? (removed * STAGGER) / 2 : 0;
    if (document.activeElement?.id === "access-code") placeRing(Math.min(code.length, LENGTH - 1), landed, true);

    if (code.length === LENGTH && added > 0 && !reduce) {
      const start = landed + 120; // once the last character has mostly grown in
      slots().forEach((slot, i) => {
        slot.getAnimations().filter((a) => a.id === "wave").forEach((a) => a.cancel());
        slot.animate(WAVE.map((f, j) => (j === 1 ? { ...f, easing: easing.wave } : f)), { duration: 460, delay: start + i * WAVE_STEP, id: "wave" });
      });
      ring.current?.getAnimations().filter((a) => a.id === "wave").forEach((a) => a.cancel());
      ring.current?.animate(WAVE.map((f, j) => (j === 1 ? { ...f, easing: easing.wave } : f)), { duration: 460, delay: start + (LENGTH - 1) * WAVE_STEP, id: "wave", composite: "add" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // The ring fades in where the focus lands, and out where it is when the field loses it.
  useLayoutEffect(() => {
    const el = ring.current;
    if (!el) return;
    if (focused) placeRing(activeIndex, 0, false);
    const current = parseFloat(getComputedStyle(el).opacity) || 0;
    el.getAnimations().filter((a) => a.id === "ring-fade").forEach((a) => a.cancel());
    el.animate([{ opacity: current }, { opacity: focused ? 1 : 0 }], { duration: 160, easing: "ease-out", fill: "forwards", id: "ring-fade" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  // Keep the ring on its box when the layout changes size (e.g. turning a phone).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => placeRing(Math.min(previous.current.length, LENGTH - 1), 0, false));
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form action={action} onSubmit={() => setEditedSinceError(false)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-[30px] font-semibold leading-tight">{t.title}</h1>
        <p className="text-[15px] leading-normal text-icon">{t.intro}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <label htmlFor="access-code" className="flex-1 text-sm font-semibold">
            {t.codeLabel}
          </label>
          <button
            type="button"
            aria-pressed={show}
            onClick={() => setShow((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-teal-deep"
          >
            <Icon name="eye" size={16} />
            {show ? t.hideCode : t.showCode}
          </button>
        </div>

        <div ref={box} className="relative">
          <div aria-hidden="true" className="grid grid-cols-8 gap-[5px] md:gap-2">
            {Array.from({ length: LENGTH }, (_, i) => {
              const filled = i < code.length;
              const active = focused && i === activeIndex;
              const border = error ? "border-danger" : filled ? "border-filled-line" : "border-line-strong";
              return (
                <span
                  key={i}
                  data-slot
                  className={`flex h-[46px] items-center justify-center rounded-[10px] border-2 transition-colors duration-200 md:h-14 md:rounded-[14px] ${CHAR_TEXT} ${border} ${active ? "bg-surface" : "bg-mint"}`}
                >
                  {filled ? (
                    <span data-char className="inline-block origin-bottom">
                      {show ? code[i] : "•"}
                    </span>
                  ) : active && !ready ? (
                    <span className="zk-caret h-[22px] w-[2px] rounded-full bg-teal md:h-[26px]" />
                  ) : null}
                </span>
              );
            })}
          </div>
          {/* The ring of the active box, gliding between boxes, and copies of characters on their way out. */}
          <span ref={ghosts} aria-hidden="true" className="pointer-events-none absolute inset-0" />
          <span
            ref={ring}
            aria-hidden="true"
            className={`pointer-events-none absolute left-0 top-0 rounded-[10px] border-2 opacity-0 transition-colors duration-200 md:rounded-[14px] ${error ? "border-danger shadow-[0_0_0_3px_rgb(179_38_30/0.16)]" : "border-teal shadow-[0_0_0_3px_rgb(11_127_123/0.16)]"}`}
          />
          <input
            id="access-code"
            name="code"
            type="text"
            value={code}
            onChange={(e) => {
              const next = e.target.value.replace(/\s/g, "").slice(0, LENGTH);
              if (next.length < code.length) noteLeaving(next);
              setCode(next);
              setEditedSinceError(true);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={LENGTH}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!error}
            aria-describedby={error ? "code-error" : undefined}
            className="absolute inset-0 size-full cursor-text border-0 text-base opacity-0"
          />
        </div>

        {error && (
          <p id="code-error" role="alert" className="flex items-start gap-2 text-sm font-medium leading-snug text-danger">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            {error === "tooMany" ? t.tooMany : t.invalid}
          </p>
        )}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="remember" defaultChecked className="size-5 accent-teal" />
        {t.remember}
      </label>

      <button
        type="submit"
        disabled={!ready || pending}
        className={`flex min-h-[54px] items-center justify-center gap-2 rounded-full text-base font-semibold ${ready && !pending ? "bg-sun text-ink" : "cursor-not-allowed bg-line text-icon"}`}
      >
        {pending ? t.submitting : t.submit}
        <Icon name="arrowRight" />
      </button>

      <div className="flex flex-col items-center gap-1 text-center text-[13px] leading-normal text-muted">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5">
          {t.noCode}
          <button
            type="button"
            aria-expanded={help}
            onClick={() => setHelp((v) => !v)}
            className="min-h-11 px-1 font-semibold text-teal-deep underline"
          >
            {t.askNew}
          </button>
        </p>
        {help && <p className="rounded-2xl bg-mint px-4 py-3 text-ink-soft">{t.askNewHelp}</p>}
      </div>
    </form>
  );
}
