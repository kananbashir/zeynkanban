"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ShownRelease } from "@/lib/whats-new";
import { Collapse } from "./motion";
import { KIND_COLORS, longDate } from "./whats-new-window";

type T = Dictionary["whatsNew"];

function Version({ r, live, t }: { r: ShownRelease; live: boolean; t: T }) {
  const kinds = (["new", "improved", "fixed"] as const).filter((k) => r.items.some((i) => i.kind === k));
  return (
    <li className="flex flex-col gap-2 rounded-[18px] bg-mint-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <b className="font-mono text-[15px] font-semibold">{r.version}</b>
        <span className="text-[12.5px] text-muted">{longDate(r.date, t)}</span>
        {live && <span className="ml-auto rounded-full bg-leaf-tint px-2.5 py-0.5 text-[11px] font-extrabold text-leaf-ink">{t.liveNow}</span>}
      </div>
      <ul className="flex flex-col gap-1.5">
        {kinds.map((k) => (
          <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-normal text-ink-soft">
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider ${KIND_COLORS[k]}`}>{t.kinds[k]}</span>
            <span className="min-w-0 flex-1">
              {r.items
                .filter((i) => i.kind === k)
                .map((i) => i.title)
                .join("; ")}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Every version with what changed, newest first; the running one is marked "Live now". Older ones fold away. */
export function VersionList({ releases, current, t }: { releases: ShownRelease[]; current: string; t: T }) {
  const [more, setMore] = useState(false);
  const first = releases.slice(0, 3);
  const older = releases.slice(3);
  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-2.5">
        {first.map((r) => (
          <Version key={r.version} r={r} live={r.version === current} t={t} />
        ))}
      </ul>
      {older.length > 0 && (
        <>
          <Collapse open={more}>
            <ul className="flex flex-col gap-2.5">
              {older.map((r) => (
                <Version key={r.version} r={r} live={r.version === current} t={t} />
              ))}
            </ul>
          </Collapse>
          <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} className="self-start rounded-full px-1 py-2 text-[13px] font-bold text-teal-deep">
            {more ? t.hide : t.showOlder}
          </button>
        </>
      )}
    </div>
  );
}
