"use client";

import { useState } from "react";
import { btn, field } from "@/components/ui";
import { Plus } from "./users-section";

/** A one-field form at the bottom of a list: type a name, press Add. */
export function AddNameForm({ label, buttonLabel, disabled, onAdd }: { label: string; buttonLabel: string; disabled: boolean; onAdd: (name: string, reset: () => void) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-wrap gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd(name, () => setName(""));
      }}
    >
      <input className={`${field} flex-[1_1_220px]`} aria-label={label} placeholder={label} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
      <button type="submit" className={btn.primary} disabled={disabled || !name.trim()}>
        <Plus />
        {buttonLabel}
      </button>
    </form>
  );
}
