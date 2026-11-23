"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavKey } from "@/lib/roles";
import { Icon } from "./icons";

type Item = { key: NavKey; href: string; label: string; short: string };

const buttonBase = "flex size-[52px] items-center justify-center rounded-full";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/**
 * Navigation. On wide screens: the icon rail on the left, main pages on top, settings and about at
 * the bottom. On phones: a bar along the bottom of the screen with a sliding marker; About is on the
 * Settings page there. Logging out is only on the Settings page, behind a confirmation.
 */
export function Rail({ items, about, mainLabel }: { items: Item[]; about: Item; mainLabel: string }) {
  const pathname = usePathname();
  const top = items.filter((item) => item.key !== "settings");
  const settings = items.find((item) => item.key === "settings");

  const link = (item: Item) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-label={item.label}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={`${buttonBase} transition-colors duration-200 ${active ? "bg-sun text-ink" : "text-icon hover:bg-mint"}`}
      >
        <Icon name={item.key} />
      </Link>
    );
  };

  const activeIndex = items.findIndex((item) => isActive(pathname, item.href));

  return (
    <>
      <nav aria-label={mainLabel} className="hidden w-[72px] flex-col items-center gap-3 lg:flex">
        <Image src="/logo-mark.png" alt="Zeyn Media" width={256} height={256} className="size-[52px] rounded-[18px]" />
        <div className="flex flex-col gap-1.5 rounded-[36px] bg-surface p-2">{top.map(link)}</div>
        <div className="flex-1" />
        <div className="flex flex-col gap-1.5 rounded-[36px] bg-surface p-2">
          {settings && link(settings)}
          {link(about)}
        </div>
      </nav>

      <nav aria-label={mainLabel} className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        <div className="relative mx-auto flex max-w-[520px] rounded-[28px] bg-surface/95 p-1.5 shadow-[0_10px_36px_rgba(24,35,47,0.2)] backdrop-blur-md">
          {activeIndex >= 0 && (
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 top-1.5 left-1.5 rounded-[22px] bg-sun transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ width: `calc((100% - 12px) / ${items.length})`, transform: `translateX(${activeIndex * 100}%)` }}
            />
          )}
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative z-[1] flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-semibold leading-tight transition-colors duration-200 ${active ? "text-on-pastel" : "text-icon"}`}
              >
                <Icon name={item.key} size={22} />
                <span className="max-w-full truncate px-1">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
