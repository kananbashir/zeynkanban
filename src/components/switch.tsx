"use client";

import { useRef } from "react";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

/** An on/off switch. The knob slides across on a spring and stretches a little on the way. */
export function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const knob = useRef<HTMLSpanElement>(null);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        const next = !checked;
        if (knob.current && !prefersReducedMotion())
          knob.current.animate(
            [{ transform: `translateX(${next ? 0 : 18}px)` }, { transform: "translateX(9px) scaleX(1.25)", offset: 0.4 }, { transform: `translateX(${next ? 18 : 0}px)` }],
            { duration: 460, easing: springOrFallback(380, 34, 0.46) },
          );
        onChange(next);
      }}
      className="flex min-h-11 items-center gap-2.5 text-left text-sm font-medium disabled:opacity-60"
    >
      <span className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors duration-300 ${checked ? "bg-teal" : "bg-line-strong"}`}>
        <span ref={knob} className="absolute left-[3px] top-[3px] size-[22px] rounded-full bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.25)]" style={{ transform: `translateX(${checked ? 18 : 0}px)` }} />
      </span>
      {label}
    </button>
  );
}
