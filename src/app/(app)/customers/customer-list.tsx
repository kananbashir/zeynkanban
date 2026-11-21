"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";

type Customer = { id: string; name: string; color: string; archived: boolean };

/** The customer list: a side panel on wide screens, a dropdown on phones. */
export function CustomerList({ customers, canAdd, t }: { customers: Customer[]; canAdd: boolean; t: Dictionary["customers"] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const currentId = pathname.split("/")[2] ?? "";
  const visible = customers.filter((c) => showArchived || !c.archived || c.id === currentId);
  const hasArchived = customers.some((c) => c.archived);

  return (
    <aside aria-label={t.listTitle} className="flex min-w-0 flex-col gap-2.5 rounded-[28px] bg-white px-4 py-4 lg:w-[300px] lg:shrink-0 lg:px-5 lg:py-[22px]">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold">{t.listTitle}</h2>
        {canAdd && (
          <Link href="/customers/new" aria-label={t.add} title={t.add} className="flex size-11 items-center justify-center rounded-full bg-sun text-ink">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        )}
      </div>

      {visible.length > 0 && (
        <select
          aria-label={t.listTitle}
          className="h-12 rounded-[14px] border-[1.5px] border-line-strong bg-white px-3 text-[15px] font-semibold lg:hidden"
          value={currentId}
          onChange={(e) => router.push(`/customers/${e.target.value}`)}
        >
          {!currentId && <option value="">{t.pickOne}</option>}
          {visible.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? ` (${t.archivedBadge})` : ""}
            </option>
          ))}
        </select>
      )}

      <nav className="hidden flex-col gap-1 lg:flex">
        {visible.map((c) => {
          const active = c.id === currentId;
          return (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-2.5 rounded-[14px] px-3 py-1.5 text-sm ${active ? "bg-teal text-white" : "text-ink hover:bg-mint"}`}
            >
              <span className="size-3 shrink-0 rounded-full border-[1.5px] border-black/20" style={{ background: c.color }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
              {c.archived && <span className="text-xs font-medium opacity-80">{t.archivedBadge}</span>}
            </Link>
          );
        })}
      </nav>

      {hasArchived && (
        <button type="button" className={`${btn.mint} self-start`} onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
          {showArchived ? t.hideArchived : t.showArchived}
        </button>
      )}
    </aside>
  );
}
