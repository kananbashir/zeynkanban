"use client";

import { useRef } from "react";

/**
 * Text that edits in place. Saves when the field loses focus or Enter is pressed;
 * Escape puts the saved text back, and so does an empty value unless `allowEmpty` (then it clears it).
 */
export function InlineText({
  value,
  label,
  onSave,
  className = "",
  placeholder,
  mono = false,
  allowEmpty = false,
}: {
  value: string;
  label: string;
  onSave: (next: string) => void;
  className?: string;
  placeholder?: string;
  mono?: boolean;
  allowEmpty?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      key={value}
      ref={ref}
      type="text"
      defaultValue={value}
      aria-label={label}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        const next = e.currentTarget.value.replace(/\s+/g, " ").trim();
        if ((!next && !allowEmpty) || next === value) {
          e.currentTarget.value = value;
          return;
        }
        onSave(next);
      }}
      className={`h-10 w-full min-w-0 rounded-[10px] border-[1.5px] border-transparent bg-transparent px-2.5 text-[15px] font-semibold text-ink hover:border-line-strong hover:bg-surface focus:border-line-strong focus:bg-surface ${mono ? "font-mono text-[13px] font-medium" : ""} ${className}`}
    />
  );
}
