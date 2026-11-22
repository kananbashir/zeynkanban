"use client";

import { useState } from "react";
import { btn, field } from "@/components/ui";
import { Plus } from "./users-section";

/** A form at the bottom of a list: type a name (and, optionally, its English version), press Add. */
export function AddNameForm({
  label,
  labelEn,
  buttonLabel,
  disabled,
  onAdd,
}: {
  label: string;
  labelEn?: string;
  buttonLabel: string;
  disabled: boolean;
  onAdd: (name: string, reset: () => void, nameEn: string) => void;
}) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  return (
    <form
      className="flex flex-wrap gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim())
          onAdd(
            name,
            () => {
              setName("");
              setNameEn("");
            },
            nameEn,
          );
      }}
    >
      <input className={`${field} flex-[1_1_220px]`} aria-label={label} placeholder={label} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
      {labelEn && <input className={`${field} flex-[1_1_180px]`} aria-label={labelEn} placeholder={labelEn} value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={60} autoComplete="off" />}
      <button type="submit" className={btn.primary} disabled={disabled || !name.trim()}>
        <Plus />
        {buttonLabel}
      </button>
    </form>
  );
}
