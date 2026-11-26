"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { logout } from "@/app/login/actions";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { CloseButton, ConfirmDialog, onTop, track } from "./dialog";
import { Icon, type IconName } from "./icons";

type Texts = {
  open: string;
  title: string;
  settings: string;
  picture: string;
  aboutMe: string;
  soon: string;
  close: string;
  logout: string;
  logoutTitle: string;
  logoutText: string;
  cancel: string;
};

const noop = () => () => {};

/**
 * The logged-in person at the top right. Tapping it opens a panel from the right edge (on phones
 * and computers) with Settings, room for a profile picture and "about me" later, and Log out
 * (after a confirmation). It slides in on a spring and slides back out when closed.
 */
export function ProfileMenu({ name, initials, roleLabel, t }: { name: string; initials: string; roleLabel: string; t: Texts }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t.open}: ${name}`}
        className="flex h-[52px] min-w-0 items-center gap-2.5 rounded-full bg-surface py-1.5 pl-1.5 pr-4 transition-shadow hover:shadow-[0_0_0_2px_var(--color-teal)] focus-visible:shadow-[0_0_0_2px_var(--color-teal)]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal text-[13px] font-semibold text-white">{initials}</span>
        <span className="flex min-w-0 flex-col text-left leading-tight">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-xs text-muted">{roleLabel}</span>
        </span>
      </button>
      {open && <Panel name={name} initials={initials} roleLabel={roleLabel} t={t} onClose={close} />}
    </>
  );
}

function Panel({ name, initials, roleLabel, t, onClose }: { name: string; initials: string; roleLabel: string; t: Texts; onClose: () => void }) {
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const startPath = useRef(pathname);
  const done = useRef(onClose);
  useLayoutEffect(() => {
    done.current = onClose;
  });

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = panel.current;
    if (!el || prefersReducedMotion()) return done.current();
    el.animate([{ transform: "none" }, { transform: "translateX(105%)" }], { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }).onfinish = () => done.current();
    scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
  }, []);

  // Slides in from the right edge.
  useLayoutEffect(() => {
    if (!inBrowser || prefersReducedMotion()) return;
    panel.current?.animate([{ transform: "translateX(105%)" }, { transform: "none" }], { duration: 520, easing: springOrFallback(320, 32, 0.52) });
    scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  }, [inBrowser]);

  useEffect(() => {
    if (!inBrowser) return;
    const me = {};
    const untrack = track(me);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onTop(me) && close();
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
  }, [inBrowser, close]);

  // Going to another page (Settings) closes the panel.
  useEffect(() => {
    if (pathname !== startPath.current) done.current();
  }, [pathname]);

  const stopAsking = useCallback(() => setAsking(false), []);
  if (!inBrowser) return null;

  const row = "flex min-h-[54px] items-center gap-3 rounded-2xl bg-surface px-3.5 text-[15px] font-semibold";
  const badge = (icon: IconName, danger = false) => (
    <span aria-hidden="true" className={`flex size-[34px] shrink-0 items-center justify-center rounded-[11px] ${danger ? "bg-[color-mix(in_oklab,var(--color-danger)_16%,transparent)] text-danger" : "bg-teal-tint text-teal-deep"}`}>
      <Icon name={icon} size={18} />
    </span>
  );

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div ref={scrim} aria-hidden="true" onClick={close} className="absolute inset-0 bg-scrim" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[min(360px,88vw)] flex-col gap-4 overflow-y-auto rounded-l-[28px] bg-mint px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] shadow-[-20px_0_50px_rgba(24,35,47,0.3)] outline-none"
      >
        <div className="flex items-center gap-3 border-b border-line px-1.5 pb-4 pt-1">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal text-[19px] font-bold text-white">{initials}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[17px] font-semibold">{name}</span>
            <span className="truncate text-[13px] text-ink-soft">{roleLabel}</span>
          </span>
          <CloseButton label={t.close} onClick={close} />
        </div>
        <nav className="flex flex-col gap-2.5">
          <Link href="/settings" onClick={close} className={`${row} transition-colors hover:bg-teal-tint`}>
            {badge("settings")}
            <span className="flex-1">{t.settings}</span>
            <Icon name="chevronRight" size={17} className="text-icon" />
          </Link>
          <div aria-disabled="true" className={`${row} opacity-45`}>
            {badge("image")}
            <span className="flex-1">{t.picture}</span>
            <span className="text-[11px] font-bold uppercase text-muted">{t.soon}</span>
          </div>
          <div aria-disabled="true" className={`${row} opacity-45`}>
            {badge("user")}
            <span className="flex-1">{t.aboutMe}</span>
            <span className="text-[11px] font-bold uppercase text-muted">{t.soon}</span>
          </div>
        </nav>
        <span className="flex-1" />
        <button type="button" onClick={() => setAsking(true)} className={`${row} text-left text-danger transition-colors hover:bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-surface))]`}>
          {badge("logout", true)}
          {t.logout}
        </button>
      </div>
      {asking && <ConfirmDialog title={t.logoutTitle} text={t.logoutText} confirmLabel={t.logout} cancelLabel={t.cancel} pending={pending} onCancel={stopAsking} onConfirm={() => startTransition(() => logout())} />}
    </div>,
    document.body,
  );
}
