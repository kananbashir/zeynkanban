"use client";

import { useTransition } from "react";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";

type Result = { ok: true } | { ok: false; error: ErrorKey };

/** Runs a settings action and shows its error, if any, as a message. */
export function useAction(errors: Dictionary["errors"], show: (text: string, tone?: "info" | "error") => void) {
  const [pending, startTransition] = useTransition();
  function run<R extends Result>(action: () => Promise<R>, onOk?: (result: R) => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) onOk?.(result);
        else show(errors[result.error], "error");
      } catch {
        show(errors.generic, "error");
      }
    });
  }
  return { pending, run };
}
