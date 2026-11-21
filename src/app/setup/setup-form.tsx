"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { btn, field } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { createFirstAdmin, type SetupState } from "./actions";

const INITIAL: SetupState = { code: null, error: null };

export function SetupForm({
  t,
  errors,
  copyLabels,
}: {
  t: Dictionary["setup"];
  errors: Dictionary["errors"];
  copyLabels: { copy: string; copied: string; copyFailed: string };
}) {
  const [state, action, pending] = useActionState(createFirstAdmin, INITIAL);
  const [note, setNote] = useState("");

  if (state.code) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-[26px] font-semibold leading-tight">{t.codeTitle}</h1>
        <div className="flex flex-col gap-3 rounded-[18px] bg-sun-tint p-4">
          <span className="select-all font-mono text-[26px] font-medium tracking-[3px]">{state.code}</span>
          <span className="text-sm leading-normal text-sun-ink">{t.codeText}</span>
          <button
            type="button"
            className={`${btn.soft} self-start`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.code!);
                setNote(copyLabels.copied);
              } catch {
                setNote(copyLabels.copyFailed);
              }
            }}
          >
            {copyLabels.copy}
          </button>
          {note && <span role="status" className="text-[13px] text-sun-ink">{note}</span>}
        </div>
        <Link href="/login" className={`${btn.primary} min-h-[54px] text-base`}>
          {t.toLogin}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold leading-tight">{t.title}</h1>
        <p className="text-[15px] leading-normal text-icon">{t.intro}</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t.name}
        <input name="name" className={field} autoComplete="name" required maxLength={60} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error === "taken" ? t.taken : errors[state.error]}
        </p>
      )}
      {state.error === "taken" ? (
        <Link href="/login" className={`${btn.primary} min-h-[54px] text-base`}>
          {t.toLogin}
        </Link>
      ) : (
        <button type="submit" disabled={pending} className={`${btn.primary} min-h-[54px] text-base`}>
          {pending ? t.creating : t.create}
        </button>
      )}
    </form>
  );
}
