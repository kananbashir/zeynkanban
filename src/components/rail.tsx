"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import type { NavKey } from "@/lib/roles";
import { Icon } from "./icons";

type Item = { key: NavKey; href: string; label: string };

const buttonBase = "flex size-[42px] items-center justify-center rounded-full lg:size-[52px]";

/** The icon rail: main pages on top, settings and log out at the bottom. Which pages appear depends on the role. */
export function Rail({ items, logoutLabel, mainLabel }: { items: Item[]; logoutLabel: string; mainLabel: string }) {
  const pathname = usePathname();
  const top = items.filter((item) => item.key !== "settings");
  const settings = items.find((item) => item.key === "settings");

  const link = (item: Item) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-label={item.label}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={`${buttonBase} ${active ? "bg-sun text-ink" : "text-icon hover:bg-mint"}`}
      >
        <Icon name={item.key} />
      </Link>
    );
  };

  return (
    <nav aria-label={mainLabel} className="flex w-full flex-row items-center gap-3 lg:w-[72px] lg:flex-col">
      <Image src="/logo-mark.png" alt="Zeyn Media" width={256} height={256} className="hidden size-[52px] rounded-[18px] lg:block" />
      <div className="flex flex-row gap-1.5 rounded-[36px] bg-white p-2 lg:flex-col">{top.map(link)}</div>
      <div className="flex-1" />
      <div className="flex flex-row gap-1.5 rounded-[36px] bg-white p-2 lg:flex-col">
        {settings && link(settings)}
        <form action={logout}>
          <button type="submit" aria-label={logoutLabel} title={logoutLabel} className={`${buttonBase} text-icon hover:bg-mint`}>
            <Icon name="logout" />
          </button>
        </form>
      </div>
    </nav>
  );
}
