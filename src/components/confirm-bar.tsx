"use client";

import { btn } from "@/components/ui";

export function ConfirmBar({ text, confirmLabel, cancelLabel, onConfirm, onCancel, disabled }: { text: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] bg-sun-tint py-2.5 pl-3.5 pr-2.5">
      <span className="flex-[1_1_240px] text-[13px] leading-normal text-sun-ink">{text}</span>
      <button type="button" className={btn.danger} onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </button>
      <button type="button" className={btn.soft} onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}
