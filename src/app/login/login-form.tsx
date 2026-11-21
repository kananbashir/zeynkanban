"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/icons";
import type { Dictionary } from "@/i18n/dictionaries";
import { login, type LoginState } from "./actions";

const LENGTH = 8;
const INITIAL: LoginState = { error: null };

export function LoginForm({ t }: { t: Dictionary["login"] }) {
  const [state, action, pending] = useActionState(login, INITIAL);
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const [editedSinceError, setEditedSinceError] = useState(false);
  const [help, setHelp] = useState(false);

  const error = state.error && !editedSinceError ? state.error : null;
  const ready = code.length === LENGTH;
  const activeIndex = Math.min(code.length, LENGTH - 1);

  return (
    <form action={action} onSubmit={() => setEditedSinceError(false)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-[30px] font-semibold leading-tight">{t.title}</h1>
        <p className="text-[15px] leading-normal text-icon">{t.intro}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <label htmlFor="access-code" className="flex-1 text-sm font-semibold">
            {t.codeLabel}
          </label>
          <button
            type="button"
            aria-pressed={show}
            onClick={() => setShow((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-teal-deep"
          >
            <Icon name="eye" size={16} />
            {show ? t.hideCode : t.showCode}
          </button>
        </div>

        <div className="relative">
          <div aria-hidden="true" className="grid grid-cols-8 gap-[5px] md:gap-2">
            {Array.from({ length: LENGTH }, (_, i) => {
              const filled = i < code.length;
              const active = focused && i === activeIndex;
              const border = error ? "border-danger" : active ? "border-teal" : filled ? "border-[#9fcfcb]" : "border-line-strong";
              return (
                <span
                  key={i}
                  className={`flex h-[46px] items-center justify-center rounded-[10px] border-2 font-mono text-lg font-medium md:h-14 md:rounded-[14px] md:text-[22px] ${border} ${active ? "bg-white" : "bg-mint"}`}
                >
                  {filled ? (show ? code[i] : "•") : ""}
                </span>
              );
            })}
          </div>
          <input
            id="access-code"
            name="code"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\s/g, "").slice(0, LENGTH));
              setEditedSinceError(true);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={LENGTH}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={!!error}
            aria-describedby={error ? "code-error" : undefined}
            className="absolute inset-0 size-full cursor-text border-0 text-base opacity-0"
          />
        </div>

        {error && (
          <p id="code-error" role="alert" className="flex items-start gap-2 text-sm font-medium leading-snug text-danger">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            {error === "tooMany" ? t.tooMany : t.invalid}
          </p>
        )}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="remember" defaultChecked className="size-5 accent-teal" />
        {t.remember}
      </label>

      <button
        type="submit"
        disabled={!ready || pending}
        className={`flex min-h-[54px] items-center justify-center gap-2 rounded-full text-base font-semibold ${ready && !pending ? "bg-sun text-ink" : "cursor-not-allowed bg-line text-icon"}`}
      >
        {pending ? t.submitting : t.submit}
        <Icon name="arrowRight" />
      </button>

      <div className="flex flex-col items-center gap-1 text-center text-[13px] leading-normal text-muted">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5">
          {t.noCode}
          <button
            type="button"
            aria-expanded={help}
            onClick={() => setHelp((v) => !v)}
            className="min-h-11 px-1 font-semibold text-teal-deep underline"
          >
            {t.askNew}
          </button>
        </p>
        {help && <p className="rounded-2xl bg-mint px-4 py-3 text-ink-soft">{t.askNewHelp}</p>}
      </div>
    </form>
  );
}
