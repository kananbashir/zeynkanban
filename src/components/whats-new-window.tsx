"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { markWhatsNewSeen } from "@/app/actions/whats-new";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import type { ReleaseIcon, ReleaseKind, ShownItem, ShownRelease } from "@/lib/whats-new";
import { onTop, track } from "./dialog";
import { Collapse } from "./motion";

type T = Dictionary["whatsNew"];

export const RELEASE_ICONS: Record<ReleaseIcon, string> = {
  finished: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  icons: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3zM9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  motion: "M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  keyboard: "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  brief: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
  deadline: "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18M8 15h8",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  search: "M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3",
  status: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M15 9l-6 6M9 9l6 6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  sparkle: "M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 3v4M17 5h4",
  chart: "M3 3v18h18M7 16v-4M12 16V8M17 16v-7",
  pin: "M12 17v5M9 10.8V5h6v5.8l2.6 2.7c.3.3.4.6.4 1V15H6v-.5c0-.4.1-.7.4-1zM8 5h8",
};
export const KIND_COLORS: Record<ReleaseKind, string> = { new: "bg-leaf-tint text-leaf-ink", improved: "bg-teal-tint text-teal-deep", fixed: "bg-sun-tint text-sun-ink" };

const noop = () => () => {};

/** "27 November 2026" / "27 noyabr 2026". */
export function longDate(iso: string, t: T) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${t.months[m - 1]} ${y}`;
}

function Svg({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

/** One version's items, grouped under New, Improved and Fixed. */
function Groups({ items, t }: { items: ShownItem[]; t: T }) {
  const kinds = (["new", "improved", "fixed"] as const).filter((k) => items.some((i) => i.kind === k));
  return (
    <>
      {kinds.map((kind) => (
        <section key={kind} aria-label={t.kinds[kind]} className="flex flex-col">
          <h3 className="mb-1.5">
            <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-wider ${KIND_COLORS[kind]}`}>{t.kinds[kind]}</span>
          </h3>
          <ul className="flex flex-col">
            {items
              .filter((i) => i.kind === kind)
              .map((i, n) => (
                <li key={i.title} className={`flex gap-3 py-2.5 ${n ? "border-t border-line" : ""}`}>
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-mint text-teal-deep">
                    <Svg d={RELEASE_ICONS[i.icon]} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <b className="text-sm font-semibold">
                      {i.title}
                    </b>
                    <span className="text-[13px] leading-snug text-ink-soft">{i.text}</span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/**
 * "What's new": shown once per person, the first time they open the site after a version with
 * visible changes goes live. A window in the middle on a computer, a sheet sliding up from the
 * bottom on a phone (it can be swiped down). Versions skipped in between are folded underneath.
 */
export function WhatsNewWindow({ releases, t }: { releases: ShownRelease[]; t: T }) {
  const [open, setOpen] = useState(true);
  // Only in the browser (the window goes into <body>): the server's page has nothing here.
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const [older, setOlder] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const isSheet = () => typeof window !== "undefined" && !window.matchMedia("(min-width: 640px)").matches;

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    markWhatsNewSeen().catch(() => {});
    const el = panel.current;
    if (!el || prefersReducedMotion()) return setOpen(false);
    const from = getComputedStyle(el).transform;
    const a = el.animate(
      [{ transform: from === "none" ? "none" : from, opacity: 1 }, isSheet() ? { transform: "translateY(100%)", opacity: 1 } : { transform: "translateY(10px) scale(0.97)", opacity: 0 }],
      { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
    );
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
    a.onfinish = () => setOpen(false);
  };
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });

  useLayoutEffect(() => {
    if (!inBrowser || !open || prefersReducedMotion()) return;
    panel.current?.animate(isSheet() ? [{ transform: "translateY(100%)" }, { transform: "none" }] : [{ transform: "translateY(16px) scale(0.96)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: isSheet() ? 520 : 480,
      easing: springOrFallback(isSheet() ? 300 : 420, isSheet() ? 30 : 28, isSheet() ? 0.52 : 0.48),
    });
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [inBrowser]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!inBrowser || !open) return;
    const me = {};
    const untrack = track(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTop(me) && closeRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      untrack();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, inBrowser]);

  // Swiping the sheet's top down closes it; let go early and it springs back.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isSheet() || e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
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

  if (!inBrowser || !open || !releases.length) return null;
  const [latest, ...rest] = releases;
  const versions = rest.length > 1 ? `${rest.slice(1).map((r) => r.version).reverse().join(", ")} ${t.and} ${rest[0].version}` : rest[0]?.version;
  const content = (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <div ref={scrim} aria-hidden="true" onClick={close} className="absolute inset-0 bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${t.title} · ${fill(t.version, { version: latest.version })}`}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-[0_-12px_40px_rgba(24,35,47,0.25)] outline-none sm:max-h-[min(680px,calc(100dvh-48px))] sm:max-w-[540px] sm:rounded-[28px] sm:shadow-[0_24px_64px_rgba(24,35,47,0.3)]"
      >
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="relative touch-none bg-gradient-to-br from-teal to-[#0a5e5b] px-5 pb-5 pt-3 text-white sm:touch-auto sm:px-6 sm:pt-[22px]">
          <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-white/50 sm:hidden" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider">
            <Svg d={RELEASE_ICONS.sparkle} size={14} />
            {t.title}
          </span>
          <h2 className="mb-0.5 mt-2.5 text-[22px] font-semibold sm:text-2xl">{fill(t.version, { version: latest.version })}</h2>
          <p className="text-[13.5px] text-[#cfeee9]">{longDate(latest.date, t)}</p>
          <button type="button" aria-label={t.close} onClick={close} className="absolute right-4 top-5 flex size-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 sm:top-4">
            <Svg d="M6 6l12 12M18 6 6 18" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain px-[18px] py-4 sm:px-[22px]">
          <Groups items={latest.items} t={t} />
          {rest.length > 0 && (
            <div className="flex flex-col rounded-[16px] bg-mint-soft">
              <button type="button" aria-expanded={older} onClick={() => setOlder((v) => !v)} className="flex min-h-11 items-center gap-2 px-3.5 py-2 text-left text-[13px] text-muted">
                <span className="flex-1">{fill(t.alsoIn, { versions })}</span>
                <span className="flex items-center gap-1 font-bold text-teal-deep">
                  {older ? t.hide : t.show}
                  <span className={`transition-transform duration-300 ${older ? "rotate-180" : ""}`}>
                    <Svg d="m6 9 6 6 6-6" size={14} />
                  </span>
                </span>
              </button>
              <Collapse open={older}>
                <div className="flex flex-col gap-4 px-3.5 pb-3.5">
                  {rest.map((r) => (
                    <div key={r.version} className="flex flex-col gap-2.5 border-t border-line pt-3">
                      <span className="text-[13px] font-bold">
                        {r.version} <span className="font-medium text-muted">· {longDate(r.date, t)}</span>
                      </span>
                      <Groups items={r.items} t={t} />
                    </div>
                  ))}
                </div>
              </Collapse>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 border-t border-line px-[18px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 sm:px-[22px] sm:pb-[18px]">
          <Link href="/about#versions" onClick={close} className="mr-auto rounded-full px-1 py-2 text-[13px] font-bold text-teal-deep">
            {t.allVersions} <span aria-hidden="true">→</span>
          </Link>
          <button type="button" onClick={close} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink">
            {t.gotIt}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
