"use client";

import { useCallback, useState, useTransition } from "react";
import { logout } from "@/app/login/actions";
import { ConfirmDialog } from "./dialog";
import { Icon } from "./icons";

/** Log out, after a confirmation: logging back in needs the access code, so nobody leaves by accident. */
export function LogoutButton({ label, title, text, cancelLabel }: { label: string; title: string; text: string; cancelLabel: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const cancel = useCallback(() => setAsking(false), []);
  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className="flex min-h-11 items-center gap-2 rounded-full bg-mint px-4 text-sm font-semibold hover:bg-teal-tint">
        <Icon name="logout" size={16} />
        {label}
      </button>
      {asking && <ConfirmDialog title={title} text={text} confirmLabel={label} cancelLabel={cancelLabel} pending={pending} onCancel={cancel} onConfirm={() => startTransition(() => logout())} />}
    </>
  );
}
