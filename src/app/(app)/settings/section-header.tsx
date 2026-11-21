import type { ReactNode } from "react";

export function SectionHeader({ title, intro, action }: { title: string; intro: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <div className="flex flex-[1_1_280px] flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="max-w-[64ch] text-sm leading-normal text-ink-soft">{intro}</p>
      </div>
      {action}
    </div>
  );
}
